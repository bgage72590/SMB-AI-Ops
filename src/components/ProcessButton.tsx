"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  emailId?: string;
  label?: string;
  variant?: "primary" | "ghost";
}

export function ProcessButton({ emailId, label, variant = "primary" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(emailId ? { emailId } : {}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  }

  const classes =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent/90"
      : "bg-ink-50 text-ink-700 hover:bg-ink-100";

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${classes} disabled:opacity-50`}
      >
        {loading
          ? "Processing..."
          : label || (emailId ? "Process email" : "Process inbox")}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
