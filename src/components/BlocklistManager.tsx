"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";
import { useToast } from "./Toast";
import { ConfirmDialog } from "./ConfirmDialog";

interface Entry {
  id: string;
  pattern: string;
  reason?: string;
  createdAt: string;
}

export function BlocklistManager({
  initialEntries,
}: {
  initialEntries: Entry[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [entries, setEntries] = useState(initialEntries);
  const [pattern, setPattern] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Entry | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!pattern.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/blocklist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pattern: pattern.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const { entry } = await res.json();
      setEntries((prev) => [entry, ...prev]);
      setPattern("");
      toast("Sender blocked", "success");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    setError(null);
    try {
      const res = await fetch("/api/blocklist", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast("Entry removed from blocklist", "success");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="Email or domain (e.g. spam@example.com or example.com)"
          className="flex-1 h-9 px-3 text-sm rounded-md border border-border bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={adding}
          disabled={adding || !pattern.trim()}
        >
          Block
        </Button>
      </form>

      {error && (
        <p className="text-[11px] text-danger">{error}</p>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-fg-muted py-3 text-center">
          No blocked senders yet. Add an email address or domain above.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="py-2.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <code className="text-sm font-mono text-fg">{entry.pattern}</code>
                {entry.reason && (
                  <span className="ml-2 text-xs text-fg-subtle">
                    {entry.reason}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConfirmRemove(entry)}
                disabled={removing === entry.id}
                className="shrink-0 text-xs text-danger hover:underline disabled:opacity-50"
              >
                {removing === entry.id ? "..." : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove from blocklist?"
        message={
          confirmRemove
            ? `Remove "${confirmRemove.pattern}" from the blocklist? Emails from this sender will be processed again.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        loading={removing !== null}
        onConfirm={() => {
          if (confirmRemove) {
            handleRemove(confirmRemove.id);
            setConfirmRemove(null);
          }
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
