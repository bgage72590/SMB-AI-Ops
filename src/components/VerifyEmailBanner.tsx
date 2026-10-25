"use client";

import { useState } from "react";
import { Button } from "./ui";

interface Props {
  email: string;
}

export function VerifyEmailBanner({ email }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/verify/resend", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setState("error");
    }
  }

  return (
    <div className="border border-warning/40 bg-warning-soft rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-fg">Confirm your email</p>
        <p className="text-xs text-fg-muted mt-0.5">
          We sent a link to {email}. AI triage, sending and texting turn on
          once you click it. Until then, triage uses the basic rules.
        </p>
        {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0 whitespace-nowrap"
        onClick={resend}
        loading={state === "sending"}
        disabled={state === "sending" || state === "sent"}
      >
        {state === "sent" ? "Sent" : "Resend link"}
      </Button>
    </div>
  );
}
