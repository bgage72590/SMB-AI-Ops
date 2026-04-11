"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Theme state is a three-way toggle: user can pick light or dark
// explicitly, or leave it on "system" which tracks the OS preference.
// We persist the user's choice to localStorage. The server render is
// always light (no DOM) and a tiny inline script in the <head> applies
// the correct class synchronously before React hydrates, which prevents
// a flash of wrong theme.
export type ThemeChoice = "light" | "dark" | "system";

interface ThemeContextValue {
  /** What the user picked ("system" = follow OS). */
  choice: ThemeChoice;
  /** Currently rendered theme, after resolving "system". */
  resolved: "light" | "dark";
  setChoice: (choice: ThemeChoice) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "smb-ai-ops-theme";

function readStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function systemIsDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  // On first mount, pull the stored choice and apply it. We don't read
  // localStorage during useState init because SSR would mismatch.
  useEffect(() => {
    const stored = readStoredChoice();
    const next = stored === "system" ? (systemIsDark() ? "dark" : "light") : stored;
    setChoiceState(stored);
    setResolved(next);
    applyTheme(next);
  }, []);

  // While the user is on "system", listen for OS changes and re-resolve.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolved(next);
      applyTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setChoiceState(next);
    const r = next === "system" ? (systemIsDark() ? "dark" : "light") : next;
    setResolved(r);
    applyTheme(r);
  }, []);

  const toggle = useCallback(() => {
    setChoice(resolved === "dark" ? "light" : "dark");
  }, [resolved, setChoice]);

  const value = useMemo<ThemeContextValue>(
    () => ({ choice, resolved, setChoice, toggle }),
    [choice, resolved, setChoice, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // During tests or stories we render without a provider. Fall back to
    // a no-op so components don't crash.
    return {
      choice: "system",
      resolved: "light",
      setChoice: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

/**
 * Inline script that runs before React hydrates. Put the stringified
 * version in a <script dangerouslySetInnerHTML> tag in the root layout.
 * Reads localStorage and flips the dark class synchronously so there's
 * no flash of the wrong theme on first paint.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${STORAGE_KEY}';var s=localStorage.getItem(k);var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s==='dark'||((s==='system'||!s)&&m);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
