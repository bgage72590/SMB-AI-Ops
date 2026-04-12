"use client";

import { useTheme, type ThemeChoice } from "./ThemeProvider";

// Three-way theme picker shown in the user menu. We render as a small
// segmented control rather than a cycling button so "system" is a
// first-class option — a lot of users genuinely want their app to
// follow the OS and a plain light/dark toggle hides that.
const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: string }> = [
  { value: "light", label: "Light", icon: "☀" },
  { value: "system", label: "System", icon: "◐" },
  { value: "dark", label: "Dark", icon: "☾" },
];

export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-lg border border-border bg-surface-2 p-0.5 text-xs"
    >
      {OPTIONS.map((opt) => {
        const active = choice === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setChoice(opt.value)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors ${
              active
                ? "bg-surface text-fg shadow-card"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            <span aria-hidden>{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
