"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  currentStatus: "draft" | "approved" | "sent" | "dismissed";
  canSend: boolean;
}

export function FollowUpActions({ id, currentStatus, canSend }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchStatus(status: Props["currentStatus"]) {
    setLoading(status);
    setError(null);
    try {
      const response = await fetch("/api/followups", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(null);
    }
  }

  async function dispatchSend() {
    setLoading("send");
    setError(null);
    try {
      const response = await fetch("/api/followups/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || `HTTP ${response.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(null);
    }
  }

  if (currentStatus === "sent") {
    return <span className="text-xs text-emerald-700 font-medium">Sent</span>;
  }
  if (currentStatus === "dismissed") {
    return <span className="text-xs text-ink-400">Dismissed</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {canSend ? (
          <button
            type="button"
            onClick={dispatchSend}
            disabled={loading !== null}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            title="Send via Postmark"
          >
            {loading === "send" ? "Sending..." : "Send"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => patchStatus("sent")}
            disabled={loading !== null}
            className="px-2.5 py-1 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            title="Mark this follow-up as sent (no provider configured)"
          >
            {loading === "sent" ? "..." : "Mark sent"}
          </button>
        )}
        <button
          type="button"
          onClick={() => patchStatus("dismissed")}
          disabled={loading !== null}
          className="px-2.5 py-1 text-xs font-medium rounded-md bg-ink-50 text-ink-600 hover:bg-ink-100 disabled:opacity-50"
        >
          {loading === "dismissed" ? "..." : "Dismiss"}
        </button>
      </div>
      {error && (
        <span className="text-[11px] text-rose-600 max-w-xs text-right">
          {error}
        </span>
      )}
    </div>
  );
}
