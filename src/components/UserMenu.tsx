"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, fall through to navigate — the cookie
      // won't be cleared server-side, but the user will end up on /login.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <ThemeToggle />
      <div className="text-right leading-tight hidden sm:block">
        <div className="text-fg font-medium">{name}</div>
        <div className="text-fg-subtle text-xs">{email}</div>
      </div>
      <button
        type="button"
        onClick={logout}
        disabled={loading}
        className="px-2.5 py-1 text-xs font-medium rounded-md bg-surface-2 text-fg-muted hover:bg-border disabled:opacity-50"
      >
        {loading ? "…" : "Log out"}
      </button>
    </div>
  );
}
