"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

interface Props {
  endpoints: Endpoint[];
}

const ALL_EVENTS = [
  { value: "contact.created", label: "Contact created" },
  { value: "contact.updated", label: "Contact updated" },
  { value: "deal.created", label: "Job created" },
  { value: "deal.updated", label: "Job updated" },
  { value: "deal.stage_changed", label: "Job stage changed" },
  { value: "email.received", label: "Email received" },
  { value: "email.processed", label: "Email processed" },
  { value: "followup.created", label: "Follow-up drafted" },
  { value: "followup.sent", label: "Follow-up sent" },
  { value: "invoice.created", label: "Invoice created" },
  { value: "invoice.status_changed", label: "Invoice status changed" },
];

export function WebhookManager({ endpoints }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/webhooks/endpoints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          events: selectedEvents,
          secret: secret.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create webhook");
      }
      setUrl("");
      setSecret("");
      setSelectedEvents([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    await fetch("/api/webhooks/endpoints", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch("/api/webhooks/endpoints", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Existing endpoints */}
      {endpoints.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] divide-y divide-border">
          {endpoints.map((ep) => (
            <div key={ep.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono text-fg truncate">
                  {ep.url}
                </div>
                <div className="text-xs text-fg-subtle mt-0.5">
                  {ep.events.length === 0
                    ? "All events"
                    : `${ep.events.length} event${ep.events.length !== 1 ? "s" : ""}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle(ep.id, !ep.enabled)}
                className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                  ep.enabled
                    ? "bg-success/10 text-success"
                    : "bg-surface-2 text-fg-subtle"
                }`}
              >
                {ep.enabled ? "Active" : "Paused"}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(ep.id)}
                className="text-xs text-danger hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5">
        <h3 className="text-sm font-semibold text-fg mb-4">
          Add webhook endpoint
        </h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              required
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">
              Signing secret (optional)
            </label>
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="A random string to verify payloads"
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              If set, each delivery includes an X-Webhook-Signature header (HMAC SHA-256).
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-2">
              Events (leave empty for all)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_EVENTS.map((ev) => (
                <label
                  key={ev.value}
                  className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(ev.value)}
                    onChange={() => toggleEvent(ev.value)}
                    className="rounded border-border"
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="text-xs text-danger">{error}</div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={creating}
            disabled={creating || !url.trim()}
          >
            Add endpoint
          </Button>
        </form>
      </div>
    </div>
  );
}
