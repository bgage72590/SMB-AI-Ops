"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  invoiceId: string;
  status: string;
  publicUrl: string;
}

export function InvoiceActions({ invoiceId, status, publicUrl }: Props) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function updateStatus(newStatus: string, extra?: Record<string, string>) {
    setUpdating(true);
    try {
      await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: invoiceId, status: newStatus, ...extra }),
      });
      router.refresh();
    } finally {
      setUpdating(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "draft" && (
        <button
          type="button"
          disabled={updating}
          onClick={() =>
            updateStatus("sent", { sentAt: new Date().toISOString() })
          }
          className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Mark as sent
        </button>
      )}
      {status === "sent" && (
        <>
          <button
            type="button"
            disabled={updating}
            onClick={() => updateStatus("accepted")}
            className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg bg-success/10 text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
          >
            Accepted
          </button>
          <button
            type="button"
            disabled={updating}
            onClick={() => updateStatus("declined")}
            className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50 transition-colors"
          >
            Declined
          </button>
        </>
      )}
      {(status === "sent" || status === "accepted") && (
        <button
          type="button"
          disabled={updating}
          onClick={() =>
            updateStatus("paid", { paidAt: new Date().toISOString() })
          }
          className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg bg-success/10 text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
        >
          Mark paid
        </button>
      )}
      {status !== "void" && status !== "paid" && (
        <button
          type="button"
          disabled={updating}
          onClick={() => updateStatus("void")}
          className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg border border-border text-fg-muted hover:bg-surface-2 disabled:opacity-50 transition-colors"
        >
          Void
        </button>
      )}
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg border border-border text-fg-muted hover:bg-surface-2 transition-colors"
      >
        {copied ? "Copied!" : "Copy client link"}
      </button>
    </div>
  );
}
