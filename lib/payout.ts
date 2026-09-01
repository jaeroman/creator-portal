import { Prisma } from "@/lib/generated/prisma/client";
import type { PayoutRequest, PrismaClient } from "@/lib/generated/prisma/client";
import { LedgerEntryType, PayoutStatus } from "@/lib/generated/prisma/enums";
import { formatMinor } from "@/lib/format";
import { sumAvailableBalance } from "@/lib/wallet";

// PayoutRequest.amountMinor is a Postgres int4. Past this the driver raises a
// range error instead of anything a user could act on, so the ceiling is
// checked here where a message can be returned.
const MAX_AMOUNT_MINOR = 2_147_483_647;

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export type ParsedAmount =
  | { ok: true; amountMinor: number }
  | { ok: false; error: string };

export type BalanceCheck = { ok: true } | { ok: false; error: string };

// Never parseFloat. `Number.parseFloat("0.29") * 100` is 28.999999999999996,
// which truncates to 28 cents and quietly underpays. Both sides of the decimal
// are parsed as integers instead, so the arithmetic is exact.
export function parseAmountMinor(raw: unknown): ParsedAmount {
  if (typeof raw !== "string") {
    return { ok: false, error: "Enter an amount to request." };
  }

  const cleaned = raw.trim().replace(/^\$/, "").replace(/,/g, "").trim();

  if (cleaned.length === 0) {
    return { ok: false, error: "Enter an amount to request." };
  }

  if (!AMOUNT_PATTERN.test(cleaned)) {
    return {
      ok: false,
      error: "Enter an amount in dollars, like 25 or 25.50.",
    };
  }

  const [dollarPart, centPart = ""] = cleaned.split(".");
  const dollars = Number.parseInt(dollarPart, 10);
  const cents = Number.parseInt(centPart.padEnd(2, "0") || "0", 10);
  const amountMinor = dollars * 100 + cents;

  if (amountMinor === 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }

  if (amountMinor > MAX_AMOUNT_MINOR) {
    return { ok: false, error: "That amount is too large to request." };
  }

  return { ok: true, amountMinor };
}

export function checkAgainstBalance(
  amountMinor: number,
  availableMinor: number,
): BalanceCheck {
  if (availableMinor <= 0) {
    return {
      ok: false,
      error: "You have no available balance to request right now.",
    };
  }

  if (amountMinor > availableMinor) {
    return {
      ok: false,
      error: `That is more than your available balance of ${formatMinor(availableMinor)}.`,
    };
  }

  return { ok: true };
}

const SERIALIZATION_FAILURE = "40001";

// Postgres raises 40001 when serializable isolation catches two payout requests
// racing, and it is the only error worth another attempt: P2002 means the
// idempotency key already exists, which retrying cannot change.
//
// Two shapes, because Prisma 7 through a driver adapter does not raise the
// documented P2034. It throws a DriverAdapterError with no `code` of its own,
// carrying the raw SQLSTATE on `cause`. Matching only P2034 silently retried
// nothing, which a four-way race caught.
export function isRetryableTransactionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ((error as { code?: unknown }).code === "P2034") {
    return true;
  }

  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause !== "object" || cause === null) {
    return false;
  }

  return (
    (cause as { originalCode?: unknown }).originalCode ===
      SERIALIZATION_FAILURE ||
    (cause as { kind?: unknown }).kind === "TransactionWriteConflict"
  );
}

export async function withRetry<T>(
  attempt: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let remaining = maxAttempts; remaining > 0; remaining -= 1) {
    try {
      return await attempt();
    } catch (error) {
      if (!isRetryableTransactionError(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
}

export type PayoutRequestInput = {
  creatorId: string;
  amountMinor: number;
  idempotencyKey: string;
};

export type CreatePayoutResult =
  | { kind: "created"; request: PayoutRequest }
  | { kind: "duplicate"; request: PayoutRequest }
  | { kind: "overdrawn"; error: string };

const TRANSACTION_OPTIONS = {
  // Serializable is what makes invariant 4 provable: two requests that read the
  // same balance and both write a hold are a read-write dependency Postgres
  // detects, so one is aborted with 40001 rather than both committing.
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  // Neon suspends an idle compute and the wake takes a few seconds. Prisma's 2s
  // default makes the first request after an idle period fail with P2028.
  maxWait: 10_000,
  timeout: 15_000,
} as const;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

// Takes the client rather than closing over the singleton so a script can drive
// it directly, which is the only way to prove the concurrent case.
export async function createPayoutRequest(
  client: PrismaClient,
  { creatorId, amountMinor, idempotencyKey }: PayoutRequestInput,
): Promise<CreatePayoutResult> {
  try {
    return await withRetry(() =>
      client.$transaction(async (tx) => {
        // Re-read inside the boundary. Whatever the page rendered is already
        // stale, and an earlier request may have taken the funds since.
        const availableMinor = await sumAvailableBalance(tx, creatorId);
        const check = checkAgainstBalance(amountMinor, availableMinor);

        if (!check.ok) {
          // Returning commits an empty transaction, which is cheaper than
          // throwing and keeps an expected outcome off the error path.
          return { kind: "overdrawn" as const, error: check.error };
        }

        const request = await tx.payoutRequest.create({
          data: {
            creatorId,
            amountMinor,
            status: PayoutStatus.PENDING,
            idempotencyKey,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            creatorId,
            type: LedgerEntryType.PAYOUT_HOLD,
            // Negative, so the hold needs no special case anywhere: available
            // balance is just the sum of a signed ledger.
            amountMinor: -amountMinor,
            description: "Payout request hold",
            payoutRequestId: request.id,
          },
        });

        return { kind: "created" as const, request };
      }, TRANSACTION_OPTIONS),
    );
  } catch (error) {
    // The unique index on idempotencyKey is the guarantee, not a prior lookup:
    // checking first would just be a smaller race.
    if (isDuplicateKeyError(error)) {
      const existing = await client.payoutRequest.findFirst({
        where: { idempotencyKey, creatorId },
      });

      if (existing) {
        return { kind: "duplicate", request: existing };
      }
    }

    throw error;
  }
}
