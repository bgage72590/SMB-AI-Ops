"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "signup";

const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "That email and password don't match.",
  email_taken: "An account with that email already exists.",
  weak_password: "Password must be at least 8 characters.",
  missing_fields: "Please fill out every field.",
  validation_failed: "Please check the form and try again.",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
      const body = isSignup
        ? { email, password, name }
        : { email, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const code = typeof data.error === "string" ? data.error : "unknown";
        setError(ERROR_COPY[code] || "Something went wrong. Try again.");
        return;
      }
      // Full navigation so server components re-read the new cookie.
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16">
      <div className="card p-6">
        <h1 className="text-xl font-semibold text-fg">
          {isSignup ? "Create your workspace" : "Sign in"}
        </h1>
        <p className="text-sm text-fg-muted mt-1">
          {isSignup
            ? "A fresh workspace with sample clients, jobs, and emails."
            : "Welcome back."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {isSignup && (
            <Field
              label="Your name"
              type="text"
              value={name}
              onChange={setName}
              autoComplete="name"
              required
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
          />

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
            {loading
              ? "…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>

          {!isSignup && (
            <div className="text-xs text-fg-muted text-center -mt-1">
              <Link href="/forgot" className="text-accent hover:underline">
                Forgot your password?
              </Link>
            </div>
          )}
        </form>

        <div className="text-xs text-fg-muted text-center mt-4">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-accent hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link href="/signup" className="text-accent hover:underline">
                Create a workspace
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-fg-muted mb-1">
        {props.label}
      </span>
      <input
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoComplete={props.autoComplete}
        required={props.required}
        className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );
}
