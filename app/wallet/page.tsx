import type { Metadata } from "next";
import SummaryCard from "@/components/wallet/SummaryCard";
import { PayoutStatus } from "@/lib/generated/prisma/enums";
import { getCreator } from "@/lib/creator";
import { formatDate, formatMinor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  getWalletHistory,
  sumAvailableBalance,
  sumPendingEarnings,
  type WalletHistoryRow,
} from "@/lib/wallet";

export const metadata: Metadata = {
  title: "Wallet",
};

const CELL = "border-t border-border px-4 py-3 align-top";

// Feature 6 renders these same words on the request flow; lift this into a
// shared module if a third file needs it.
const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  [PayoutStatus.PENDING]: "Pending",
  [PayoutStatus.APPROVED]: "Approved",
  [PayoutStatus.REJECTED]: "Rejected",
};

function describe(row: WalletHistoryRow): string {
  if (row.kind === "entry") {
    return row.description;
  }

  return row.status === PayoutStatus.REJECTED
    ? "Payout request, funds returned to your balance"
    : "Payout request";
}

export default async function WalletPage() {
  const creator = await getCreator();
  const [availableMinor, pendingMinor, history] = await Promise.all([
    sumAvailableBalance(prisma, creator.id),
    sumPendingEarnings(prisma, creator.id),
    getWalletHistory(prisma, creator.id),
  ]);

  return (
    <>
      <h1 className="text-xl font-semibold">Wallet</h1>
      <p className="mt-2 text-muted">
        Every figure below is summed from the ledger, never stored.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Available balance"
          value={formatMinor(availableMinor)}
          note="Ready to request. Excludes pending earnings and anything held by an open payout request."
        />
        <SummaryCard
          label="Pending earnings"
          value={formatMinor(pendingMinor)}
          note="Earned but not yet cleared, so it cannot be paid out yet."
        />
      </div>

      <h2 className="mt-8 text-lg font-semibold">Transaction history</h2>

      {history.length === 0 ? (
        <p className="mt-4 rounded border border-border bg-surface px-4 py-6 text-muted">
          No transactions yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded border border-border bg-surface">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Earnings, adjustments, and payout requests, newest first
            </caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="px-4 py-3 font-medium">
                  Date
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Description
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={`${row.kind}-${row.id}`}>
                  <td className={`${CELL} whitespace-nowrap`}>
                    <time dateTime={row.date.toISOString()}>
                      {formatDate(row.date)}
                    </time>
                  </td>
                  <td className={CELL}>{describe(row)}</td>
                  <td className={CELL}>
                    {row.kind === "payout" ? (
                      <>
                        {PAYOUT_STATUS_LABELS[row.status]}
                        {row.decidedAt ? (
                          <span className="block text-muted">
                            {formatDate(row.decidedAt)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true" className="text-muted">
                          -
                        </span>
                        <span className="sr-only">No status</span>
                      </>
                    )}
                  </td>
                  <td className={`${CELL} text-right tabular-nums`}>
                    {formatMinor(row.amountMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-muted">
        A payout request appears as one row. The ledger rows behind it, the hold
        and its release, are what the balances above are summed from.
      </p>
    </>
  );
}
