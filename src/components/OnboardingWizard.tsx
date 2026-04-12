"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

interface Props {
  inboundAddress: string;
}

const STEPS = [
  {
    title: "Set up email forwarding",
    description:
      "Forward your customer emails so the AI can triage them, draft replies, and update your CRM automatically.",
  },
  {
    title: "Add a Gmail filter",
    description:
      "Create a filter in Gmail that auto-forwards matching emails to your AI inbox. This takes about 60 seconds.",
  },
  {
    title: "You're all set!",
    description:
      "When the first email arrives, the AI will triage it and you'll see it in your inbox. Approve the draft reply and it goes out.",
  },
];

export function OnboardingWizard({ inboundAddress }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [emailArrived, setEmailArrived] = useState(false);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(inboundAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.getElementById("onboarding-address");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  useEffect(() => {
    if (step !== 2) return;
    setChecking(true);
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/inbox?limit=1");
        if (res.ok) {
          const data = await res.json();
          if (data.emails?.length > 0) {
            if (!cancelled) setEmailArrived(true);
            return;
          }
        }
      } catch {}
      if (!cancelled) setTimeout(poll, 5000);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [step]);

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-accent" : "bg-border"
            }`}
          />
        ))}
      </div>

      <h2 className="text-xl font-bold text-fg">{STEPS[step].title}</h2>
      <p className="text-sm text-fg-muted mt-2 mb-6">
        {STEPS[step].description}
      </p>

      {/* Step 1: Show address */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-surface-2/50 p-4">
            <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold mb-2">
              Your AI inbox address
            </div>
            <div className="flex items-center gap-3">
              <code
                id="onboarding-address"
                className="font-mono text-sm text-fg select-all flex-1 truncate"
              >
                {inboundAddress}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                className="shrink-0 inline-flex items-center h-8 px-3 text-xs font-medium rounded-lg bg-surface text-fg border border-border hover:bg-surface-2 transition-colors"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <p className="text-sm text-fg-muted">
            This is the address the AI monitors. In the next step you'll set up
            Gmail to forward customer emails here automatically.
          </p>

          <Button
            type="button"
            variant="primary"
            onClick={() => setStep(1)}
          >
            Next: Set up Gmail filter
          </Button>
        </div>
      )}

      {/* Step 2: Gmail filter instructions */}
      {step === 1 && (
        <div className="space-y-6">
          <ol className="space-y-4 text-sm text-fg-muted">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-accent-fg text-xs font-bold flex items-center justify-center">
                1
              </span>
              <span>
                Open{" "}
                <strong className="text-fg">Gmail Settings</strong> (gear icon
                in the top right) and click{" "}
                <strong className="text-fg">See all settings</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-accent-fg text-xs font-bold flex items-center justify-center">
                2
              </span>
              <span>
                Go to the{" "}
                <strong className="text-fg">
                  Forwarding and POP/IMAP
                </strong>{" "}
                tab. Click{" "}
                <strong className="text-fg">Add a forwarding address</strong>{" "}
                and paste your AI inbox address:
              </span>
            </li>
          </ol>

          <div className="rounded-lg border border-border bg-surface-2/50 p-3 flex items-center gap-3">
            <code className="font-mono text-sm text-fg select-all flex-1 truncate">
              {inboundAddress}
            </code>
            <button
              type="button"
              onClick={copyAddress}
              className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md bg-surface border border-border hover:bg-surface-2"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <ol start={3} className="space-y-4 text-sm text-fg-muted">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-accent-fg text-xs font-bold flex items-center justify-center">
                3
              </span>
              <span>
                Gmail will ask you to confirm. Check your AI inbox or click
                the confirmation link in the verification email.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-accent-fg text-xs font-bold flex items-center justify-center">
                4
              </span>
              <span>
                Go to the <strong className="text-fg">Filters and Blocked Addresses</strong>{" "}
                tab. Click{" "}
                <strong className="text-fg">Create a new filter</strong>. Set
                the criteria to match customer emails (e.g.{" "}
                <code className="bg-surface rounded px-1 py-0.5 text-xs">
                  is:inbox -from:me
                </code>
                ), then choose{" "}
                <strong className="text-fg">Forward it to</strong> your AI
                inbox address.
              </span>
            </li>
          </ol>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(0)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setStep(2)}
            >
              I've set up forwarding
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Waiting / Success */}
      {step === 2 && (
        <div className="space-y-6">
          {emailArrived ? (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
              <div className="text-2xl mb-2">&#10003;</div>
              <div className="font-medium text-fg">
                Your first email arrived!
              </div>
              <p className="text-sm text-fg-muted mt-1">
                The AI is triaging it now. Head to your dashboard to see the
                results.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface-2/50 p-4 text-center">
              {checking && (
                <div className="text-sm text-fg-muted animate-pulse mb-2">
                  Waiting for your first email...
                </div>
              )}
              <p className="text-xs text-fg-subtle">
                Send a test email from your personal account to see it appear.
                We're checking every few seconds.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => router.push("/")}
            >
              {emailArrived ? "Go to dashboard" : "Skip for now"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
