"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ERROR_COPY: Record<string, string> = {
  invalid_token: "This reset link isn't valid. Request a new one.",
  token_expired: "This reset link has expired. Request a new one.",
  token_used: "This reset link has already been used.",
  weak_password: "Password must be at least 8 characters.",
  validation_failed: "Check the form and try again.",
};

/**
 * /reset?token=... — completes a password reset. The token comes from
 * the URL; we never read it from server memory. On success we redirect
 * to /login because the server has revoked every existing session for
 * the user, including any cookie this browser might have had.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="max-w-sm mx-auto mt-16">
        <div className="card p-6">
          <h1 className="text-xl font-semibold text-fg">Missing token</h1>
          <p className="text-sm text-fg-muted mt-2">
            This page needs a <code>?token=</code> query parameter from the
            email we sent you.{" "}
            <Link href="/forgot" className="text-accent hover:underline">
              Request a new link
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const code = typeof data.error === "string" ? data.error : "unknown";
        setError(ERROR_COPY[code] || "Something went wrong. Try again.");
        return;
      }
      setDone(true);
      // Short delay so the user can read the "success" state before we
      // send them to /login.
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1200);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="card p-6">
        <h1 className="text-xl font-semibold text-fg">Choose a new password</h1>
        <p className="text-sm text-fg-muted mt-1">
          Your existing sessions will be signed out after you reset.
        </p>

        {done ? (
          <div className="mt-6 text-sm text-fg bg-success-soft border border-success/30 rounded-md px-3 py-3">
            Password updated. Sending you back to sign in…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="block text-xs font-medium text-fg-muted mb-1">
                New password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-fg-muted mb-1">
                Confirm password
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>

            {error && (
              <div className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 text-sm font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "…" : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
