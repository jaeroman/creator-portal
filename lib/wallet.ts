import { LedgerEntryType, PayoutStatus } from "@/lib/generated/prisma/enums";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";

// Feature 6 re-reads the available balance inside a serializable transaction
// before committing a payout, so every derivation takes its client rather than
// closing over the singleton. Passing `tx` is the whole point.
type WalletClient = PrismaClient | Prisma.TransactionClient;

export async function sumPendingEarnings(
  client: WalletClient,
  creatorId: string,
): Promise<number> {
  const { _sum } = await client.ledgerEntry.aggregate({
    where: { creatorId, type: LedgerEntryType.EARNING_PENDING },
    _sum: { amountMinor: true },
  });

  return _sum.amountMinor ?? 0;
}

// Everything that is not a pending earning, which is why a hold needs no
// special case: it is already a negative row.
export async function sumAvailableBalance(
  client: WalletClient,
  creatorId: string,
): Promise<number> {
  const { _sum } = await client.ledgerEntry.aggregate({
    where: { creatorId, type: { not: LedgerEntryType.EARNING_PENDING } },
    _sum: { amountMinor: true },
  });

  return _sum.amountMinor ?? 0;
}

export type WalletHistoryRow =
  | {
      kind: "entry";
      id: string;
      date: Date;
      description: string;
      amountMinor: number;
    }
  | {
      kind: "payout";
      id: string;
      date: Date;
      /// Net effect on available balance, which is zero for a rejection.
      amountMinor: number;
      /// What was asked for, always positive. A rejected row nets to zero, so
      /// this is the only place the figure survives.
      requestedMinor: number;
      status: PayoutStatus;
      decidedAt: Date | null;
    };

// Every row in the history means the same thing by its amount: what it did to
// available balance. A rejection placed a hold and released it, so it did
// nothing, and showing the requested figure as money out contradicts the
// balance above the table.
export function payoutNetMinor(
  status: PayoutStatus,
  amountMinor: number,
): number {
  return status === PayoutStatus.REJECTED ? 0 : -amountMinor;
}

// A payout request writes one to three ledger rows, so showing raw ledger rows
// would make a single withdrawal look like three events. The request collapses
// into one row and only entries with no request behind them stand alone. This
// is presentation only: the balances above still come from the full ledger.
export async function getWalletHistory(
  client: WalletClient,
  creatorId: string,
): Promise<WalletHistoryRow[]> {
  const [entries, payouts] = await Promise.all([
    client.ledgerEntry.findMany({
      where: { creatorId, payoutRequestId: null },
      orderBy: { createdAt: "desc" },
    }),
    client.payoutRequest.findMany({
      where: { creatorId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: WalletHistoryRow[] = [
    ...entries.map((entry) => ({
      kind: "entry" as const,
      id: entry.id,
      date: entry.createdAt,
      description: entry.description,
      amountMinor: entry.amountMinor,
    })),
    ...payouts.map((payout) => ({
      kind: "payout" as const,
      id: payout.id,
      // The request date, because that is when the hold moved the balance.
      date: payout.createdAt,
      amountMinor: payoutNetMinor(payout.status, payout.amountMinor),
      requestedMinor: payout.amountMinor,
      status: payout.status,
      decidedAt: payout.decidedAt,
    })),
  ];

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}
