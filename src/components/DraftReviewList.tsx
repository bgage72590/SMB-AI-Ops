"use client";

import { useState, useEffect } from "react";
import { DraftReviewCard } from "./DraftReviewCard";

interface DraftData {
  id: string;
  contactName: string;
  contactEmail: string;
  dealTitle?: string;
  subject: string;
  draft: string;
  reason: string;
  createdAt: string;
  hasIcs: boolean;
  channel?: "email" | "sms";
}

interface Props {
  drafts: DraftData[];
  canSend: boolean;
}

export function DraftReviewList({ drafts, canSend }: Props) {
  const [focusIdx, setFocusIdx] = useState(0);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((prev) => Math.min(prev + 1, drafts.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((prev) => Math.max(prev - 1, 0));
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [drafts.length]);

  if (drafts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-fg-subtle">
          {drafts.length} draft{drafts.length === 1 ? "" : "s"} waiting for
          your review
        </p>
        <p className="hidden sm:block text-[10px] text-fg-subtle">
          <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border font-mono">j</kbd>
          /
          <kbd className="px-1 py-0.5 rounded bg-surface-2 border border-border font-mono">k</kbd>{" "}
          navigate
        </p>
      </div>
      <ul className="space-y-3">
        {drafts.map((d, i) => (
          <DraftReviewCard
            key={d.id}
            {...d}
            canSend={canSend}
            isFocused={i === focusIdx}
            onFocus={() => setFocusIdx(i)}
          />
        ))}
      </ul>
    </div>
  );
}
