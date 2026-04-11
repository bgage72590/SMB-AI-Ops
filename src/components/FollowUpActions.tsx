"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  id: string;
  currentStatus: "draft" | "approved" | "sent" | "dismissed";
}

export function FollowUpActions({ id, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function setStatus(status: Props["currentStatus"]) {
    setLoading(status);
    try {
      const response = await fetch("/api/followups", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      router.refresh();
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setStatus("sent")}
        disabled={loading !== null}
        className="px-2.5 py-1 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {loading === "sent" ? "..." : "Mark sent"}
      </button>
      <button
        type="button"
        onClick={() => setStatus("dismissed")}
        disabled={loading !== null}
        className="px-2.5 py-1 text-xs font-medium rounded-md bg-ink-50 text-ink-600 hover:bg-ink-100 disabled:opacity-50"
      >
        {loading === "dismissed" ? "..." : "Dismiss"}
      </button>
    </div>
  );
}
