"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";
import { formatRelative } from "@/lib/format";

interface Props {
  id: string;
  currentStatus: "draft" | "approved" | "sent" | "dismissed";
  canSend: boolean;
  sentAt?: string;
  hasIcs?: boolean;
}

export function FollowUpActions({ id, currentStatus, canSend, sentAt, hasIcs }: Props) {
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
    return (
      <span
        className="text-xs text-success font-medium"
        title={sentAt ? new Date(sentAt).toLocaleString() : undefined}
      >
        Sent{sentAt ? ` ${formatRelative(sentAt)}` : ""}
      </span>
    );
  }
  if (currentStatus === "dismissed") {
    return <span className="text-xs text-fg-subtle">Dismissed</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {hasIcs && (
          <a
            href={`/api/followups/ics?id=${id}`}
            download
            className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium text-fg-subtle hover:text-fg hover:bg-surface-raised transition-colors"
            title="Download calendar invite (.ics)"
          >
            Cal
          </a>
        )}
        {canSend ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={dispatchSend}
            loading={loading === "send"}
            disabled={loading !== null}
            title="Send via Postmark"
          >
            {loading === "send" ? "Sending…" : "Send"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => patchStatus("sent")}
            disabled={loading !== null}
            title="Mark this follow-up as sent (no provider configured)"
          >
            {loading === "sent" ? "…" : "Mark sent"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => patchStatus("dismissed")}
          disabled={loading !== null}
        >
          {loading === "dismissed" ? "…" : "Dismiss"}
        </Button>
      </div>
      {error && (
        <span className="text-[11px] text-danger max-w-xs text-right">
          {error}
        </span>
      )}
    </div>
  );
}
