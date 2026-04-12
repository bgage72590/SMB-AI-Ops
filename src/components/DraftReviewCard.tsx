"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

interface Props {
  id: string;
  contactName: string;
  contactEmail: string;
  dealTitle?: string;
  subject: string;
  draft: string;
  reason: string;
  createdAt: string;
  canSend: boolean;
  hasIcs: boolean;
  isFocused: boolean;
  onFocus: () => void;
  channel?: "email" | "sms";
}

export function DraftReviewCard({
  id,
  contactName,
  contactEmail,
  dealTitle,
  subject,
  draft,
  reason,
  createdAt,
  canSend,
  hasIcs,
  isFocused,
  onFocus,
  channel = "email",
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(subject);
  const [editBody, setEditBody] = useState(draft);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLLIElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [editing]);

  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isFocused]);

  const handleSend = useCallback(async () => {
    if (loading) return;

    if (editing) {
      setLoading("save");
      setError(null);
      try {
        const res = await fetch("/api/followups", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, subject: editSubject, draft: editBody }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || data.error || `HTTP ${res.status}`);
        }
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "save failed");
        setLoading(null);
        return;
      }
      setLoading(null);
    }

    setLoading("send");
    setError(null);
    try {
      if (canSend) {
        const res = await fetch("/api/followups/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || data.error || `HTTP ${res.status}`);
        }
      } else {
        const res = await fetch("/api/followups", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, status: "sent" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || data.error || `HTTP ${res.status}`);
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "send failed");
    } finally {
      setLoading(null);
    }
  }, [id, canSend, loading, editing, editSubject, editBody, router]);

  const handleDismiss = useCallback(async () => {
    if (loading) return;
    setLoading("dismiss");
    setError(null);
    try {
      const res = await fetch("/api/followups", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: "dismissed" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "dismiss failed");
    } finally {
      setLoading(null);
    }
  }, [id, loading, router]);

  const handleEdit = useCallback(() => {
    if (loading) return;
    setEditing(true);
  }, [loading]);

  const handleCancelEdit = useCallback(() => {
    setEditing(false);
    setEditSubject(subject);
    setEditBody(draft);
  }, [subject, draft]);

  useEffect(() => {
    if (!isFocused || editing) return;

    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          handleSend();
          break;
        case "e":
          e.preventDefault();
          handleEdit();
          break;
        case "d":
          e.preventDefault();
          handleDismiss();
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isFocused, editing, handleSend, handleEdit, handleDismiss]);

  return (
    <li
      ref={cardRef}
      onClick={onFocus}
      className={`rounded-lg border p-5 transition-colors cursor-pointer ${
        isFocused
          ? "border-accent ring-1 ring-accent bg-surface"
          : "border-border bg-surface-2/50 hover:border-fg-subtle/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="text-xs text-fg-subtle">
            To: {contactName}{" "}
            <span className="text-fg-subtle/70">
              &lt;{contactEmail}&gt;
            </span>
            {dealTitle && (
              <span className="ml-2 text-fg-muted">· {dealTitle}</span>
            )}
            {channel === "sms" && (
              <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400">
                SMS
              </span>
            )}
          </div>

          {/* Subject */}
          {editing ? (
            <input
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              className="w-full mt-1 font-medium text-fg bg-surface border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
            />
          ) : (
            <div className="font-medium text-fg mt-1">{subject}</div>
          )}

          {/* Body */}
          {editing ? (
            <textarea
              ref={textareaRef}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={8}
              className="w-full mt-3 text-sm text-fg-muted bg-surface border border-border rounded-md p-3 font-sans focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          ) : (
            <pre className="text-sm text-fg-muted mt-3 whitespace-pre-wrap font-sans bg-surface rounded-md p-3 border border-border">
              {draft}
            </pre>
          )}

          {/* Reason */}
          <div className="text-xs text-fg-subtle mt-2 italic">
            Why: {reason}
          </div>
        </div>

        {/* Right side: time */}
        <div className="text-xs text-fg-subtle shrink-0">{createdAt}</div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-between gap-3">
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
          {editing ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSend}
                loading={loading === "save" || loading === "send"}
                disabled={loading !== null}
              >
                {loading === "save" ? "Saving..." : loading === "send" ? "Sending..." : "Save & send"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={loading !== null}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSend}
                loading={loading === "send"}
                disabled={loading !== null}
              >
                {loading === "send"
                  ? "Sending..."
                  : canSend
                  ? channel === "sms" ? "Approve & text" : "Approve & send"
                  : "Mark sent"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleEdit}
                disabled={loading !== null}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                loading={loading === "dismiss"}
                disabled={loading !== null}
              >
                Dismiss
              </Button>
            </>
          )}
        </div>

        {/* Keyboard hints */}
        {isFocused && !editing && (
          <div className="hidden sm:flex items-center gap-3 text-[10px] text-fg-subtle">
            <span>
              <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border font-mono">a</kbd>{" "}
              approve
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border font-mono">e</kbd>{" "}
              edit
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border font-mono">d</kbd>{" "}
              dismiss
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-[11px] text-danger">{error}</div>
      )}
    </li>
  );
}
