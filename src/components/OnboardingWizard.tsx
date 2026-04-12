"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

interface Props {
  inboundAddress: string;
  userName: string;
}

type BusinessType =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "landscaping"
  | "cleaning"
  | "salon"
  | "contracting"
  | "other";

const BUSINESS_OPTIONS: { value: BusinessType; label: string; icon: string }[] =
  [
    { value: "plumbing", label: "Plumbing", icon: "wrench" },
    { value: "electrical", label: "Electrical", icon: "zap" },
    { value: "hvac", label: "HVAC", icon: "thermometer" },
    { value: "landscaping", label: "Landscaping", icon: "tree" },
    { value: "cleaning", label: "Cleaning", icon: "sparkles" },
    { value: "salon", label: "Salon / Barber", icon: "scissors" },
    { value: "contracting", label: "General Contracting", icon: "hammer" },
    { value: "other", label: "Other", icon: "briefcase" },
  ];

const FEATURES = [
  {
    title: "AI triages your inbox",
    desc: "Every incoming email is categorized, summarized, and linked to a client automatically.",
    icon: "inbox",
  },
  {
    title: "Jobs tracked end-to-end",
    desc: "From inquiry to completion. See your pipeline, revenue, and next steps at a glance.",
    icon: "pipeline",
  },
  {
    title: "Follow-ups drafted for you",
    desc: "The AI writes reply drafts you can approve with one click. Never forget to respond.",
    icon: "reply",
  },
];

const STEPS = [
  "Your business",
  "How it works",
  "Email setup",
  "Ready to go",
];

export function OnboardingWizard({ inboundAddress, userName }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [emailArrived, setEmailArrived] = useState(false);

  const copyAddress = useCallback(async () => {
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
  }, [inboundAddress]);

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

  function goToDashboard() {
    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={`h-1 w-full rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-border"
              }`}
            />
            <span
              className={`text-[10px] font-medium tracking-wide ${
                i <= step ? "text-accent" : "text-fg-subtle"
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 0: Business type */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-fg">
              Welcome, {userName.split(" ")[0]}!
            </h2>
            <p className="text-sm text-fg-muted mt-2">
              What kind of business do you run? This helps the AI understand your
              clients and write better replies.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {BUSINESS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBusinessType(opt.value)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  businessType === opt.value
                    ? "border-accent bg-accent/5 ring-1 ring-accent"
                    : "border-border hover:border-fg-subtle hover:bg-surface-2"
                }`}
              >
                <BusinessIcon name={opt.icon} />
                <span className="text-sm font-medium text-fg">
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="primary"
            onClick={() => setStep(1)}
            disabled={!businessType}
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 1: Feature tour */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-fg">
              Here&#39;s how it works
            </h2>
            <p className="text-sm text-fg-muted mt-2">
              Your AI office manager handles the busywork so you can focus on the
              jobs.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="flex gap-4 rounded-lg border border-border bg-surface p-4"
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-fg">{f.title}</h3>
                  <p className="text-sm text-fg-muted mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-fg-subtle">
            Your workspace is pre-loaded with sample clients, jobs, and emails so
            you can try everything right away.
          </p>

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
              Next: Connect your email
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Email setup */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-fg">
              Connect your email
            </h2>
            <p className="text-sm text-fg-muted mt-2">
              Forward customer emails to your AI inbox so it can triage them,
              draft replies, and update your CRM automatically.
            </p>
          </div>

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

          <details className="group">
            <summary className="text-sm font-medium text-accent cursor-pointer hover:underline">
              Gmail setup instructions
            </summary>
            <ol className="mt-3 space-y-3 text-sm text-fg-muted pl-1">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-accent-fg text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span>
                  Open <strong className="text-fg">Gmail Settings</strong>{" "}
                  &rarr; <strong className="text-fg">Forwarding and POP/IMAP</strong>{" "}
                  &rarr; <strong className="text-fg">Add a forwarding address</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-accent-fg text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span>Paste your AI inbox address and confirm.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-accent text-accent-fg text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <span>
                  Go to <strong className="text-fg">Filters</strong> &rarr;{" "}
                  <strong className="text-fg">Create a new filter</strong>.
                  Match incoming customer emails and choose{" "}
                  <strong className="text-fg">Forward it to</strong> your AI
                  inbox.
                </span>
              </li>
            </ol>
          </details>

          {emailArrived ? (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
              <div className="text-2xl mb-2">&#10003;</div>
              <div className="font-medium text-fg">
                Your first email arrived!
              </div>
              <p className="text-sm text-fg-muted mt-1">
                The AI is triaging it now.
              </p>
            </div>
          ) : checking ? (
            <div className="rounded-lg border border-border bg-surface-2/50 p-3 text-center">
              <div className="text-sm text-fg-muted animate-pulse">
                Waiting for your first email...
              </div>
              <p className="text-xs text-fg-subtle mt-1">
                Send a test email to see it appear, or skip for now.
              </p>
            </div>
          ) : null}

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
              onClick={() => setStep(3)}
            >
              {emailArrived ? "Continue" : "Skip for now"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Ready */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-fg">
              You&#39;re all set!
            </h2>
            <p className="text-sm text-fg-muted mt-2">
              Your workspace is ready with sample data so you can explore right
              away. Here&#39;s what to try first:
            </p>
          </div>

          <div className="space-y-3">
            <ChecklistItem
              label="Process inbox"
              desc="Click &ldquo;Process&rdquo; on any email to see the AI triage it."
            />
            <ChecklistItem
              label="Review a follow-up"
              desc="The AI drafts replies you can approve, edit, or dismiss."
            />
            <ChecklistItem
              label="Check your pipeline"
              desc="See all your jobs from inquiry through completion."
            />
            <ChecklistItem
              label="Set up email forwarding"
              desc="When you're ready, connect your real inbox to go live."
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(2)}
            >
              Back
            </Button>
            <Button type="button" variant="primary" onClick={goToDashboard}>
              Go to dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="shrink-0 w-5 h-5 rounded border-2 border-border mt-0.5" />
      <div>
        <div className="text-sm font-medium text-fg">{label}</div>
        <p className="text-xs text-fg-muted mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function BusinessIcon({ name }: { name: string }) {
  const cls = "w-5 h-5 text-fg-muted";
  switch (name) {
    case "wrench":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      );
    case "zap":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      );
    case "thermometer":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
        </svg>
      );
    case "tree":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22v-7l-2 2"/><path d="M12 13l-4-4 4-6 4 6-4 4z"/>
          <path d="M12 15l2 2"/>
        </svg>
      );
    case "sparkles":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
        </svg>
      );
    case "scissors":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
          <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>
        </svg>
      );
    case "hammer":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/>
          <path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/>
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      );
  }
}
