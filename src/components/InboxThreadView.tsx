"use client";

import { useState } from "react";
import { CategoryBadge, PriorityBadge } from "@/components/Badge";
import { formatRelative } from "@/lib/format";
import type { EmailCategory, EmailPriority } from "@/lib/types";

export interface ThreadEmail {
  id: string;
  from: string;
  fromName?: string;
  subject: string;
  body: string;
  receivedAt: string;
  category?: EmailCategory;
  priority?: EmailPriority;
  summary?: string;
  contactId?: string;
  contactName?: string;
}

interface Thread {
  key: string;
  contactName?: string;
  from: string;
  fromName?: string;
  emails: ThreadEmail[];
  latestAt: string;
}

function groupIntoThreads(emails: ThreadEmail[]): Thread[] {
  const map = new Map<string, ThreadEmail[]>();
  for (const email of emails) {
    const key = email.contactId || email.from.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(email);
  }
  const threads: Thread[] = [];
  for (const [key, group] of map) {
    group.sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
    threads.push({
      key,
      contactName: group[0].contactName,
      from: group[0].from,
      fromName: group[0].fromName,
      emails: group,
      latestAt: group[0].receivedAt,
    });
  }
  threads.sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));
  return threads;
}

export function InboxThreadView({ emails }: { emails: ThreadEmail[] }) {
  const threads = groupIntoThreads(emails);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (threads.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-subtle">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-accent text-xs">&#9734;</span>
        No triaged messages for this filter.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] divide-y divide-border overflow-hidden">
      {threads.map((thread) => {
        const isOpen = expanded.has(thread.key);
        const latest = thread.emails[0];
        const count = thread.emails.length;

        return (
          <div key={thread.key}>
            {/* Thread header */}
            <button
              type="button"
              onClick={() => count > 1 ? toggle(thread.key) : undefined}
              className={
                "w-full text-left px-4 py-3 hover:bg-surface-2/50 transition-colors " +
                (count > 1 ? "cursor-pointer" : "cursor-default")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-fg">
                      {thread.contactName || latest.fromName || latest.from}
                    </span>
                    {count > 1 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-accent/10 text-accent leading-none">
                        {count}
                      </span>
                    )}
                    {latest.category && <CategoryBadge category={latest.category} />}
                    {latest.priority && <PriorityBadge priority={latest.priority} />}
                  </div>
                  <div className="text-xs text-fg-muted mt-0.5">{latest.subject}</div>
                  {latest.summary && latest.summary !== latest.subject && (
                    <div className="text-xs text-fg-subtle mt-0.5 line-clamp-1 italic">
                      {latest.summary}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  <span className="text-[11px] text-fg-subtle whitespace-nowrap">
                    {formatRelative(latest.receivedAt)}
                  </span>
                  {count > 1 && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-fg-subtle transition-transform ${isOpen ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </div>
              </div>
            </button>

            {/* Expanded thread messages */}
            {isOpen && thread.emails.slice(1).map((email) => (
              <div
                key={email.id}
                className="px-4 py-2.5 pl-8 bg-surface-2/30 border-t border-border"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-fg-muted">
                        {email.fromName || email.from}
                      </span>
                      {email.category && <CategoryBadge category={email.category} />}
                      {email.priority && <PriorityBadge priority={email.priority} />}
                    </div>
                    <div className="text-xs text-fg-muted mt-0.5">{email.subject}</div>
                    {email.summary && email.summary !== email.subject && (
                      <div className="text-[11px] text-fg-subtle mt-0.5 italic line-clamp-1">
                        {email.summary}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-fg-subtle whitespace-nowrap shrink-0">
                    {formatRelative(email.receivedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
