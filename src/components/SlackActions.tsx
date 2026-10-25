"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

interface Props {
  channelName?: string;
}

export function SlackActions({ channelName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/slack/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  }

  if (channelName) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
            Connected
          </span>
          <span className="text-xs text-fg-muted">#{channelName}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          loading={loading}
          disabled={loading}
        >
          Disconnect
        </Button>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <a href="/api/slack/connect">
        <Button type="button" variant="secondary" size="sm">
          Add to Slack
        </Button>
      </a>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
