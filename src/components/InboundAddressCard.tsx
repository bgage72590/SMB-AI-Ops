"use client";

import { useState } from "react";
import { Chip } from "./ui";

/**
 * Shows the owner's dedicated inbound address with a one-click copy.
 * This is the address they forward inbound customer email to (or set as
 * their Google Workspace forwarding target); anything landing here gets
 * triaged by the AI pipeline and shows up in /inbox.
 */
export function InboundAddressCard({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be blocked in some iframe contexts — fall back
      // to selecting the text so the user can ⌘C manually.
      const el = document.getElementById("inbound-address");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-4 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold">
            Your inbox address
          </div>
          <Chip tone="info">Forward to me</Chip>
        </div>
        <div
          id="inbound-address"
          className="mt-2 font-mono text-sm text-fg truncate select-all"
        >
          {address}
        </div>
        <p className="text-xs text-fg-subtle mt-2 leading-relaxed">
          Forward customer email here (or set it as your Google Workspace
          forwarding target). Everything that lands gets triaged, drafted,
          and shows up in your inbox.
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg bg-surface text-fg border border-border hover:bg-surface-2 transition-colors"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
