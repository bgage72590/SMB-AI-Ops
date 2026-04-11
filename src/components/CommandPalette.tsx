"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "contact" | "deal" | "email" | "followup";

interface SearchResult {
  kind: Kind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const KIND_LABELS: Record<Kind, string> = {
  contact: "Client",
  deal: "Job",
  email: "Email",
  followup: "Follow-up",
};

/**
 * Global Cmd-K palette. Mounted once in the root layout so any page can
 * reach it. Keyboard: Cmd/Ctrl-K or `/` to open, Esc to close, ↑/↓ to
 * navigate, Enter to jump.
 *
 * Only visible to signed-in users; the layout passes `enabled={false}`
 * when nobody's logged in so the listener doesn't hijack the `/` key on
 * the auth pages.
 */
export function CommandPalette({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActive(0);
  }, []);

  // Global keyboard shortcut: Cmd/Ctrl-K toggles. `/` opens, as long as
  // the user isn't already typing in a form field.
  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !open) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
          return;
        }
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, open]);

  // Focus the input and reset state when opening.
  useEffect(() => {
    if (open) {
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Debounced fetch. 150ms feels snappy and keeps the server off the hot
  // path for every single keystroke.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results || []);
        setActive(0);
      } catch {
        // aborted or network error — ignore
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [query, open]);

  function onSelect(result: SearchResult) {
    close();
    router.push(result.href);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[active];
      if (hit) onSelect(hit);
    }
  }

  if (!enabled || !open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/40 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="w-full max-w-xl rounded-xl bg-surface shadow-pop border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search clients, jobs, emails, follow-ups…"
            className="w-full text-sm outline-none bg-transparent text-fg placeholder:text-fg-subtle"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {query.trim().length < 2 && (
            <div className="px-4 py-6 text-xs text-fg-subtle">
              Type at least 2 characters. Use{" "}
              <kbd className="px-1.5 py-0.5 text-xs border border-border rounded bg-surface-2">↑</kbd>{" "}
              <kbd className="px-1.5 py-0.5 text-xs border border-border rounded bg-surface-2">↓</kbd>{" "}
              to navigate,{" "}
              <kbd className="px-1.5 py-0.5 text-xs border border-border rounded bg-surface-2">Enter</kbd>{" "}
              to jump,{" "}
              <kbd className="px-1.5 py-0.5 text-xs border border-border rounded bg-surface-2">Esc</kbd>{" "}
              to close.
            </div>
          )}
          {query.trim().length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-6 text-xs text-fg-subtle">No matches.</div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.kind}:${r.id}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => onSelect(r)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                i === active ? "bg-surface-2" : "bg-transparent"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle w-16">
                {KIND_LABELS[r.kind]}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-fg truncate">
                  {r.title}
                </span>
                {r.subtitle && (
                  <span className="block text-xs text-fg-subtle truncate">
                    {r.subtitle}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-border text-[11px] text-fg-subtle flex items-center justify-between">
          <span>Cmd-K / Ctrl-K to toggle</span>
          {loading && <span>Searching…</span>}
        </div>
      </div>
    </div>
  );
}
