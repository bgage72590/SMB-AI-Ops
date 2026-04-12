"use client";

export function SearchTrigger() {
  function handleClick() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="hidden md:inline-flex items-center gap-2 text-xs text-fg-subtle border border-border rounded-lg px-2.5 py-1.5 hover:border-border-strong hover:text-fg transition-colors"
      title="Search (⌘K)"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span className="hidden lg:inline">Search</span>
      <kbd className="text-[10px] font-mono text-fg-subtle/70 border border-border rounded px-1 py-0.5 leading-none">
        ⌘K
      </kbd>
    </button>
  );
}
