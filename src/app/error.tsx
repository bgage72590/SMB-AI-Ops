"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-soft text-danger text-2xl font-bold mb-4">
        !
      </div>
      <h1 className="text-xl font-semibold text-fg">Something went wrong</h1>
      <p className="text-sm text-fg-muted mt-2 max-w-sm">
        An unexpected error occurred. You can try again or head back to the dashboard.
      </p>
      {error.digest && (
        <p className="text-xs text-fg-subtle mt-2 font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-lg border border-border bg-surface text-fg hover:bg-surface-2 transition-colors"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
