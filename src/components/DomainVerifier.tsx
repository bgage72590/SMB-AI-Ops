"use client";

import { useState } from "react";
import { Button } from "./ui";

interface DnsCheck {
  ok: boolean;
  records: string[];
  hint?: string;
}

interface CheckResult {
  domain: string;
  spf: DnsCheck;
  dkim: DnsCheck;
  dmarc: DnsCheck;
  allPassing: boolean;
}

export function DomainVerifier() {
  const [domain, setDomain] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/domain-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: domain.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "check failed");
    } finally {
      setChecking(false);
    }
  }

  function renderCheck(label: string, check: DnsCheck) {
    return (
      <div className="flex items-start gap-3 py-3">
        <span
          className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
            check.ok
              ? "bg-success/15 text-success"
              : "bg-danger/15 text-danger"
          }`}
        >
          {check.ok ? "\u2713" : "\u2717"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-fg">{label}</div>
          {check.records.length > 0 && (
            <pre className="text-xs text-fg-muted mt-1 whitespace-pre-wrap break-all font-mono bg-surface-2 rounded p-2">
              {check.records.join("\n")}
            </pre>
          )}
          {check.hint && (
            <p className="text-xs text-fg-subtle mt-1">{check.hint}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCheck} className="flex items-center gap-2">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="yourdomain.com"
          className="flex-1 h-9 px-3 text-sm rounded-md border border-border bg-surface text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={checking}
          disabled={checking || !domain.trim()}
        >
          Check DNS
        </Button>
      </form>

      {error && <p className="text-[11px] text-danger">{error}</p>}

      {result && (
        <div className="space-y-1">
          {result.allPassing ? (
            <div className="rounded-md bg-success/10 border border-success/30 p-3">
              <p className="text-sm font-medium text-success">
                All checks passing for {result.domain}
              </p>
              <p className="text-xs text-fg-muted mt-1">
                Your domain is properly configured for email deliverability.
              </p>
            </div>
          ) : (
            <div className="rounded-md bg-warning-soft/30 border border-warning/30 p-3">
              <p className="text-sm font-medium text-fg">
                Some records need attention for {result.domain}
              </p>
              <p className="text-xs text-fg-muted mt-1">
                Follow the hints below to fix your DNS records, then check again.
              </p>
            </div>
          )}

          <div className="divide-y divide-border">
            {renderCheck("SPF (Sender Policy Framework)", result.spf)}
            {renderCheck("DKIM (DomainKeys Identified Mail)", result.dkim)}
            {renderCheck("DMARC (Domain-based Message Authentication)", result.dmarc)}
          </div>
        </div>
      )}

      {!result && !error && (
        <div className="space-y-3 text-sm text-fg-muted">
          <p>
            Enter your sending domain above to check if SPF, DKIM, and DMARC
            records are configured correctly. These records prevent your
            follow-up emails from landing in spam.
          </p>
          <div className="space-y-2 text-xs">
            <p className="font-medium text-fg">What you need:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                <strong>SPF record</strong> — tells receiving servers which mail
                servers can send on your behalf
              </li>
              <li>
                <strong>DKIM record</strong> — cryptographically signs your
                emails so they can't be forged
              </li>
              <li>
                <strong>DMARC record</strong> — tells receivers what to do with
                emails that fail SPF/DKIM
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
