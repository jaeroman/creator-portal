"use client";

import { useEffect } from "react";
import "./globals.css";

// Replaces the root layout, so this file owns its own html and body.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <main className="mx-auto w-full max-w-5xl px-6 py-8">
          <h1 className="text-xl font-semibold">Creator Portal is unavailable</h1>
          <p className="mt-2 text-muted">
            The portal could not start. This usually means the database is
            unreachable or has not been seeded.
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
        </main>
      </body>
    </html>
  );
}
