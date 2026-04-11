"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * /forgot — asks the user for an email and POSTs to
 * /api/auth/password/request. The API always returns success, so we show
 * the same "if that email exists, we sent a link" copy regardless of the
 * response. That prevents the page from leaking whether an address is
 * registered.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/password/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Deliberately ignored — we never surface "not found" so network
      // errors might as well look the same as success.
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="card p-6">
        <h1 className="text-xl font-semibold text-fg">Reset your password</h1>
        <p className="text-sm text-fg-muted mt-1">
          Enter your email and we&apos;ll send you a link to choose a new password.
        </p>

        {submitted ? (
          <div className="mt-6 text-sm text-fg bg-success-soft border border-success/30 rounded-md px-3 py-3">
            If an account with that email exists, we just sent a reset link.
            Check your inbox within the next hour.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-xs font-medium text-fg-muted mb-1">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 text-sm font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "…" : "Send reset link"}
            </button>
          </form>
        )}

        <div className="text-xs text-fg-muted text-center mt-4">
          <Link href="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
