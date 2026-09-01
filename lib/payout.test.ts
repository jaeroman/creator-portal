import { describe, expect, it, vi } from "vitest";

import {
  checkAgainstBalance,
  isRetryableTransactionError,
  parseAmountMinor,
  withRetry,
} from "@/lib/payout";

function amountOf(raw: unknown): number {
  const parsed = parseAmountMinor(raw);
  if (!parsed.ok) {
    throw new Error(`expected ${String(raw)} to parse, got: ${parsed.error}`);
  }
  return parsed.amountMinor;
}

function errorOf(raw: unknown): string {
  const parsed = parseAmountMinor(raw);
  if (parsed.ok) {
    throw new Error(`expected ${String(raw)} to be rejected`);
  }
  return parsed.error;
}

describe("parseAmountMinor", () => {
  it("reads whole dollars", () => {
    expect(amountOf("25")).toBe(2500);
  });

  it("reads dollars and cents", () => {
    expect(amountOf("25.50")).toBe(2550);
  });

  // The regression this whole function exists for: parseFloat("0.29") * 100 is
  // 28.999999999999996, which truncates to 28.
  it("reads a cents-only amount without float drift", () => {
    expect(amountOf("0.29")).toBe(29);
  });

  it("reads every cents value in a full dollar without drift", () => {
    for (let cents = 0; cents < 100; cents += 1) {
      const raw = `1.${String(cents).padStart(2, "0")}`;
      expect(amountOf(raw)).toBe(100 + cents);
    }
  });

  it("strips thousands separators", () => {
    expect(amountOf("1,284.50")).toBe(128450);
  });

  it("strips a leading currency symbol", () => {
    expect(amountOf("$25")).toBe(2500);
  });

  it("pads a single-digit cents part", () => {
    expect(amountOf("25.5")).toBe(2550);
  });

  it("tolerates surrounding whitespace", () => {
    expect(amountOf("  40.10  ")).toBe(4010);
  });

  it("rejects a trailing decimal point", () => {
    expect(errorOf("25.")).toMatch(/dollars/);
  });

  it("rejects more than two decimal places", () => {
    expect(errorOf("25.005")).toMatch(/dollars/);
  });

  it("rejects an empty string", () => {
    expect(errorOf("")).toMatch(/Enter an amount/);
  });

  it("rejects whitespace only", () => {
    expect(errorOf("   ")).toMatch(/Enter an amount/);
  });

  it("rejects text", () => {
    expect(errorOf("abc")).toMatch(/dollars/);
  });

  it("rejects a negative amount", () => {
    expect(errorOf("-5")).toMatch(/dollars/);
  });

  it("rejects zero", () => {
    expect(errorOf("0")).toMatch(/greater than zero/);
  });

  it("rejects zero written with cents", () => {
    expect(errorOf("0.00")).toMatch(/greater than zero/);
  });

  it("rejects a non-string", () => {
    expect(errorOf(2500)).toMatch(/Enter an amount/);
    expect(errorOf(null)).toMatch(/Enter an amount/);
    expect(errorOf(undefined)).toMatch(/Enter an amount/);
  });

  it("accepts the largest amount an int4 column can hold", () => {
    expect(amountOf("21474836.47")).toBe(2_147_483_647);
  });

  it("rejects one minor unit above the int4 ceiling", () => {
    expect(errorOf("21474836.48")).toMatch(/too large/);
  });
});

describe("checkAgainstBalance", () => {
  it("allows a request for exactly the available balance", () => {
    expect(checkAgainstBalance(128450, 128450)).toEqual({ ok: true });
  });

  it("allows a request below the available balance", () => {
    expect(checkAgainstBalance(5000, 128450)).toEqual({ ok: true });
  });

  it("rejects one minor unit above the available balance", () => {
    const result = checkAgainstBalance(128451, 128450);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("$1,284.50");
  });

  it("rejects any request against a zero balance", () => {
    const result = checkAgainstBalance(1, 0);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/no available balance/);
  });

  // A negative balance should be impossible, but the guard must not read as
  // "your balance is -$5.00, so ask for less".
  it("rejects any request against a negative balance", () => {
    const result = checkAgainstBalance(1, -500);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toMatch(/no available balance/);
  });
});

function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`prisma ${code}`), { code });
}

// The real shape Prisma 7 throws through the pg driver adapter, captured from a
// four-way race against Neon. It carries no `code`, only a `cause`.
function driverAdapterConflict(): Error & { cause: unknown } {
  return Object.assign(new Error("TransactionWriteConflict"), {
    name: "DriverAdapterError",
    cause: {
      originalCode: "40001",
      originalMessage:
        "could not serialize access due to read/write dependencies among transactions",
      kind: "TransactionWriteConflict",
    },
  });
}

describe("isRetryableTransactionError", () => {
  it("treats Prisma's documented write conflict as retryable", () => {
    expect(isRetryableTransactionError(prismaError("P2034"))).toBe(true);
  });

  it("treats a driver adapter write conflict as retryable", () => {
    expect(isRetryableTransactionError(driverAdapterConflict())).toBe(true);
  });

  it("matches on the raw SQLSTATE even without the kind", () => {
    const error = Object.assign(new Error("boom"), {
      cause: { originalCode: "40001" },
    });
    expect(isRetryableTransactionError(error)).toBe(true);
  });

  it("does not retry a unique constraint violation", () => {
    expect(isRetryableTransactionError(prismaError("P2002"))).toBe(false);
  });

  it("does not retry another driver error", () => {
    const error = Object.assign(new Error("nope"), {
      cause: { originalCode: "23505", kind: "UniqueConstraintViolation" },
    });
    expect(isRetryableTransactionError(error)).toBe(false);
  });

  it("does not retry an error with no code and no cause", () => {
    expect(isRetryableTransactionError(new Error("boom"))).toBe(false);
    expect(isRetryableTransactionError(null)).toBe(false);
    expect(isRetryableTransactionError("P2034")).toBe(false);
    expect(isRetryableTransactionError({ cause: null })).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns the first successful attempt without retrying", async () => {
    const attempt = vi.fn().mockResolvedValue("committed");

    await expect(withRetry(attempt)).resolves.toBe("committed");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("retries a serialization failure and returns the later success", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(prismaError("P2034"))
      .mockRejectedValueOnce(prismaError("P2034"))
      .mockResolvedValue("committed");

    await expect(withRetry(attempt)).resolves.toBe("committed");
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("gives up after the attempt limit and rethrows the last error", async () => {
    const attempt = vi.fn().mockRejectedValue(prismaError("P2034"));

    await expect(withRetry(attempt)).rejects.toMatchObject({ code: "P2034" });
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("rethrows a non-retryable error on the first attempt", async () => {
    const attempt = vi.fn().mockRejectedValue(prismaError("P2002"));

    await expect(withRetry(attempt)).rejects.toMatchObject({ code: "P2002" });
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("honours a custom attempt limit", async () => {
    const attempt = vi.fn().mockRejectedValue(prismaError("P2034"));

    await expect(withRetry(attempt, 5)).rejects.toMatchObject({
      code: "P2034",
    });
    expect(attempt).toHaveBeenCalledTimes(5);
  });
});
