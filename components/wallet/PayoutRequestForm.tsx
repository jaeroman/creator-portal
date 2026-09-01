"use client";

import { useActionState } from "react";
import { requestPayout, type PayoutActionState } from "@/actions/payouts";
import { formatMinor } from "@/lib/format";

type PayoutRequestFormProps = {
  availableMinor: number;
  idempotencyKey: string;
};

export default function PayoutRequestForm({
  availableMinor,
  idempotencyKey,
}: PayoutRequestFormProps) {
  const [state, formAction, isPending] = useActionState<
    PayoutActionState,
    FormData
  >(requestPayout, null);

  if (availableMinor <= 0) {
    return (
      <div className="mt-6 rounded border border-border bg-surface px-4 py-4">
        <h2 className="text-sm font-medium text-muted">Request a payout</h2>
        <p className="mt-2">
          You have no available balance to request right now. Pending earnings
          become available once they clear.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded border border-border bg-surface px-4 py-4">
      <h2 className="text-sm font-medium text-muted">Request a payout</h2>

      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        {/* Minted server-side when the page rendered. Reusing it is exactly what
            makes a double submit collapse into one request. */}
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <div className="flex flex-col gap-1">
          <label htmlFor="amountDollars" className="font-medium">
            Amount in dollars
          </label>
          <input
            id="amountDollars"
            name="amountDollars"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="25.00"
            aria-describedby="amountDollars-hint"
            className="w-40 rounded border border-border bg-background px-3 py-1.5 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-border px-3 py-1.5 font-medium hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-progress disabled:text-muted"
        >
          {isPending ? "Requesting..." : "Request payout"}
        </button>
      </form>

      <p id="amountDollars-hint" className="mt-2 text-sm text-muted">
        Up to {formatMinor(availableMinor)}. The funds are held while the request
        is pending.
      </p>

      {state && !state.success ? (
        <p role="alert" className="mt-2 font-medium">
          {state.error}
        </p>
      ) : null}

      {state?.success ? (
        <p role="status" className="mt-2 font-medium">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
