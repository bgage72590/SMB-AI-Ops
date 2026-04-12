"use client";

import { useState, useEffect } from "react";

const CHANGELOG = [
  {
    version: "0.1.0",
    date: "2026-04-12",
    items: [
      "CSV export for contacts and deals",
      "Inline stage changer on job details",
      "Nav badges for unread inbox and pending drafts",
      "Client search with live filtering",
      "Keyboard shortcuts overlay (press ?)",
      "Confirmation dialogs for destructive actions",
      "Mobile-responsive pipeline and contacts views",
      "Loading skeletons across all pages",
      "Toast notifications for action feedback",
      "Breadcrumb navigation on detail pages",
    ],
  },
];

const STORAGE_KEY = "smb-ai-ops-seen-version";

export function WhatsNew() {
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    const latest = CHANGELOG[0]?.version;
    if (latest && seen !== latest) {
      setHasNew(true);
    }
  }, []);

  function handleOpen() {
    setOpen(true);
    const latest = CHANGELOG[0]?.version;
    if (latest) {
      localStorage.setItem(STORAGE_KEY, latest);
      setHasNew(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="relative text-xs text-fg-subtle hover:text-fg transition-colors"
        aria-label="What's new"
      >
        What&apos;s new
        {hasNew && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="What's new"
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface border border-border shadow-[var(--shadow-pop)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-fg">What&apos;s new</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-fg-subtle hover:text-fg text-lg leading-none"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="px-5 py-4 space-y-6 max-h-[60vh] overflow-y-auto">
              {CHANGELOG.map((release) => (
                <div key={release.version}>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-sm font-semibold text-fg">
                      v{release.version}
                    </span>
                    <span className="text-xs text-fg-subtle">{release.date}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {release.items.map((item, i) => (
                      <li
                        key={i}
                        className="text-sm text-fg-muted flex items-start gap-2"
                      >
                        <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
