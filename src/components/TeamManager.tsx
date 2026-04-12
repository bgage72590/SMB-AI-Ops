"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";
import { useToast } from "./Toast";
import { ConfirmDialog } from "./ConfirmDialog";

interface Member {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
}

interface PendingInvite {
  id: string;
  email: string;
  createdAt: string;
}

interface Props {
  members: Member[];
  pendingInvites: PendingInvite[];
  isOwner: boolean;
}

export function TeamManager({ members, pendingInvites, isOwner }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEmail("");
      toast("Invite sent", "success");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId: string) {
    setRemoving(userId);
    setError(null);
    try {
      const res = await fetch("/api/team", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast("Member removed", "success");
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
    <div className="space-y-6">
      {isOwner && (
        <form onSubmit={handleInvite} className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Invite by email"
            className="flex-1 h-9 px-3 text-sm rounded-md border border-border bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={inviting}
            disabled={inviting || !email.trim()}
          >
            Invite
          </Button>
        </form>
      )}

      {error && <p className="text-[11px] text-danger">{error}</p>}

      <div className="space-y-1">
        <h4 className="text-xs font-medium text-fg-subtle uppercase tracking-wider">
          Members
        </h4>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li
              key={m.id}
              className="py-2.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <span className="text-sm text-fg font-medium">{m.name}</span>
                <span className="ml-2 text-xs text-fg-subtle">{m.email}</span>
                {m.isOwner && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent">
                    Owner
                  </span>
                )}
              </div>
              {isOwner && !m.isOwner && (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(m)}
                  disabled={removing === m.id}
                  className="shrink-0 text-xs text-danger hover:underline disabled:opacity-50"
                >
                  {removing === m.id ? "..." : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {pendingInvites.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-fg-subtle uppercase tracking-wider">
            Pending invites
          </h4>
          <ul className="divide-y divide-border">
            {pendingInvites.map((inv) => (
              <li
                key={inv.id}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <code className="text-sm font-mono text-fg">{inv.email}</code>
                  <span className="ml-2 text-xs text-fg-subtle">
                    Invited {new Date(inv.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-xs text-fg-subtle">Pending</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isOwner && (
        <p className="text-xs text-fg-muted">
          Only the workspace owner can invite or remove members.
        </p>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove team member?"
        message={
          confirmRemove
            ? `Are you sure you want to remove ${confirmRemove.name} (${confirmRemove.email}) from your workspace?`
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
