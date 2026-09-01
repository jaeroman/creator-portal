"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The UI stays generic, so the real error only reaches the server logs.
    console.error(error);
  }, [error]);

  return (
    <>
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted">
        This page could not be loaded. Try again, and if it keeps failing check
        that the portal database is reachable.
      </p>
      {error.digest ? (
        <p className="mt-2 text-sm text-muted">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded border border-border bg-surface px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Try again
      </button>
    </>
  );
}
