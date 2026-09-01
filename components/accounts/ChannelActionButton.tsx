"use client";

import { useActionState } from "react";
import {
  setChannelConnection,
  type ChannelActionState,
} from "@/actions/accounts";

type ChannelActionButtonProps = {
  channelId: string;
  channelLabel: string;
  isConnected: boolean;
};

export default function ChannelActionButton({
  channelId,
  channelLabel,
  isConnected,
}: ChannelActionButtonProps) {
  const [state, formAction, isPending] = useActionState<
    ChannelActionState,
    FormData
  >(setChannelConnection, null);

  const intent = isConnected ? "disconnect" : "connect";
  const idleLabel = isConnected ? "Disconnect" : "Connect";
  const pendingLabel = isConnected ? "Disconnecting" : "Connecting";

  return (
    <form action={formAction}>
      <input type="hidden" name="channelId" value={channelId} />
      <input type="hidden" name="intent" value={intent} />
      <button
        type="submit"
        disabled={isPending}
        className="rounded border border-border px-3 py-1.5 font-medium hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-progress disabled:text-muted"
      >
        {isPending ? `${pendingLabel}...` : idleLabel}
        {/* The visible label repeats down the column, so the channel name is
            carried for screen readers rather than shown four times. */}
        <span className="sr-only"> {channelLabel}</span>
      </button>
      {state && !state.success ? (
        <p role="alert" className="mt-2 max-w-48 text-muted">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
