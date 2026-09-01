"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { decidePayout, type PayoutActionState } from "@/actions/payouts";
import { formatDate, formatMinor } from "@/lib/format";
import { PayoutStatus } from "@/lib/generated/prisma/enums";
import type { PayoutDecision } from "@/lib/payout";

type PendingRequest = {
  id: string;
  amountMinor: number;
  createdAt: Date;
};

type PayoutDecisionPanelProps = {
  requests: PendingRequest[];
};

type DecisionButtonProps = {
  decision: PayoutDecision;
  label: string;
  pendingLabel: string;
  requestLabel: string;
};

function DecisionButton({
  decision,
  label,
  pendingLabel,
  requestLabel,
}: DecisionButtonProps) {
  // Scoped to this row's form, so deciding one request leaves the others
  // usable. `data` says which of the two buttons was pressed, without which
  // rejecting would also put Approve into its pending label.
  const { pending, data } = useFormStatus();
  const isSubmitting = pending && data?.get("decision") === decision;

  return (
    <button
      type="submit"
      name="decision"
      value={decision}
      disabled={pending}
      className="rounded border border-border px-3 py-1.5 font-medium hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-progress disabled:text-muted"
    >
      {isSubmitting ? `${pendingLabel}...` : label}
      {/* Approve and Reject repeat down the list, so the request each one acts
          on is carried for screen readers rather than shown twice per row. */}
      <span className="sr-only"> {requestLabel}</span>
    </button>
  );
}

export default function PayoutDecisionPanel({
  requests,
}: PayoutDecisionPanelProps) {
  // One action state for the whole panel. A decided request leaves the list, so
  // per-row state would unmount along with the confirmation it just produced.
  const [state, formAction] = useActionState<PayoutActionState, FormData>(
    decidePayout,
    null,
  );

  return (
    <section className="mt-6 rounded border border-border bg-surface px-4 py-4">
      <h2 className="text-sm font-medium text-muted">Agency review</h2>
      <p className="mt-2 text-sm text-muted">
        Stand-in controls. The agency decides these behind their own login in the
        real product; this build has no accounts, so they sit here.
      </p>

      {requests.length === 0 ? (
        <p className="mt-3">No payout requests are waiting for a decision.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {requests.map((request) => {
            const requestLabel = `${formatMinor(request.amountMinor)} requested ${formatDate(request.createdAt)}`;

            return (
              <li
                key={request.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3"
              >
                <span className="font-medium tabular-nums">
                  {formatMinor(request.amountMinor)}
                </span>
                <span className="text-muted">
                  requested{" "}
                  <time dateTime={request.createdAt.toISOString()}>
                    {formatDate(request.createdAt)}
                  </time>
                </span>

                <form action={formAction} className="ml-auto flex gap-2">
                  <input
                    type="hidden"
                    name="payoutRequestId"
                    value={request.id}
                  />
                  <DecisionButton
                    decision={PayoutStatus.APPROVED}
                    label="Approve"
                    pendingLabel="Approving"
                    requestLabel={requestLabel}
                  />
                  <DecisionButton
                    decision={PayoutStatus.REJECTED}
                    label="Reject"
                    pendingLabel="Rejecting"
                    requestLabel={requestLabel}
                  />
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {state && !state.success ? (
        <p role="alert" className="mt-3 font-medium">
          {state.error}
        </p>
      ) : null}

      {state?.success ? (
        <p role="status" className="mt-3 font-medium">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
