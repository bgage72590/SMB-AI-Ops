"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

interface Props {
  provider: "gmail" | "outlook";
  connected: boolean;
  email?: string | null;
}

export function EmailConnectionActions({ provider, connected, email }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${provider}/disconnect`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/${provider}/sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }
      setSyncResult(
        `Synced ${data.imported} new email${data.imported !== 1 ? "s" : ""} (${data.total} checked)`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success/10 text-success">
            Connected
          </span>
          {email && (
            <span className="text-xs text-fg-muted">{email}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSync}
            loading={syncing}
            disabled={syncing}
          >
            Sync now
          </Button>
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
        </div>
        {syncResult && (
          <p className="text-xs text-success">{syncResult}</p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <a href={`/api/${provider}/connect`}>
        <Button type="button" variant="secondary" size="sm">
          Connect {provider === "gmail" ? "Gmail" : "Outlook"}
        </Button>
      </a>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
