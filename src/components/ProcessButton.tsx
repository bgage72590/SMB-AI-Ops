"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

interface Props {
  emailId?: string;
  label?: string;
  variant?: "primary" | "ghost" | "secondary";
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

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        onClick={run}
        loading={loading}
        variant={variant}
        size="sm"
      >
        {loading
          ? "Processing…"
          : label || (emailId ? "Process email" : "Process inbox")}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
