"use client";

import { useCallback, useEffect, useState } from "react";

const SECTIONS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["\u2318K", "Ctrl+K"], label: "Open search" },
      { keys: ["/"], label: "Quick search (when not in a field)" },
      { keys: ["Esc"], label: "Close dialog / menu" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["\u2318Enter", "Ctrl+Enter"], label: "Submit (in Ask box)" },
    ],
  },
  {
    title: "This overlay",
    shortcuts: [
      { keys: ["?"], label: "Toggle keyboard shortcuts" },
    ],
  },
];

export function KeyboardHelp({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, open, toggle]);

  if (!enabled || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface border border-border shadow-[var(--shadow-pop)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Keyboard shortcuts</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-fg-subtle hover:text-fg text-lg leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold mb-2">
                {section.title}
              </h3>
              <dl className="space-y-2">
                {section.shortcuts.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-4">
                    <dt className="text-sm text-fg-muted">{s.label}</dt>
                    <dd className="flex items-center gap-1.5">
                      {s.keys.map((key, i) => (
                        <span key={i}>
                          {i > 0 && <span className="text-[10px] text-fg-subtle mx-0.5">or</span>}
                          <kbd className="inline-flex items-center px-2 py-0.5 text-xs font-mono rounded border border-border bg-surface-2 text-fg-muted">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border text-[11px] text-fg-subtle">
          Press <kbd className="px-1.5 py-0.5 text-xs border border-border rounded bg-surface-2">?</kbd> to toggle this overlay
        </div>
      </div>
    </div>
  );
}
