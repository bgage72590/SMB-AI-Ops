"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "login" | "signup";

const ERROR_COPY: Record<string, string> = {
  invalid_credentials: "That email and password don\u2019t match.",
  email_taken: "An account with that email already exists.",
  weak_password: "Password must be at least 8 characters.",
  missing_fields: "Please fill out every field.",
  validation_failed: "Please check the form and try again.",
};

function validateEmail(v: string): string | null {
  if (!v) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address.";
  return null;
}

function validatePassword(v: string, isSignup: boolean): string | null {
  if (!v) return "Password is required.";
  if (isSignup && v.length < 8) return "Must be at least 8 characters.";
  return null;
}

function validateName(v: string): string | null {
  if (!v.trim()) return "Name is required.";
  return null;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const isSignup = mode === "signup";

  const handleBlur = useCallback(
    (field: string) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      let err: string | null = null;
      if (field === "email") err = validateEmail(email);
      if (field === "password") err = validatePassword(password, isSignup);
      if (field === "name") err = validateName(name);
      setFieldErrors((prev) => ({ ...prev, [field]: err }));
    },
    [email, password, name, isSignup]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const errors: Record<string, string | null> = {
      email: validateEmail(email),
      password: validatePassword(password, isSignup),
    };
    if (isSignup) errors.name = validateName(name);

    setFieldErrors(errors);
    setTouched({ email: true, password: true, name: true });

    if (Object.values(errors).some(Boolean)) return;

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

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {isSignup && (
            <Field
              label="Your name"
              type="text"
              value={name}
              onChange={setName}
              onBlur={() => handleBlur("name")}
              autoComplete="name"
              error={touched.name ? fieldErrors.name : null}
              required
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            onBlur={() => handleBlur("email")}
            autoComplete="email"
            error={touched.email ? fieldErrors.email : null}
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            onBlur={() => handleBlur("password")}
            autoComplete={isSignup ? "new-password" : "current-password"}
            error={touched.password ? fieldErrors.password : null}
            hint={isSignup ? "At least 8 characters" : undefined}
            required
          />

          {error && (
            <div
              className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-md px-3 py-2"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 text-sm font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading
              ? "\u2026"
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
  onBlur?: () => void;
  autoComplete?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
}) {
  const id = `field-${props.label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-fg-muted mb-1">
        {props.label}
      </label>
      <input
        id={id}
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onBlur}
        autoComplete={props.autoComplete}
        required={props.required}
        aria-invalid={props.error ? "true" : undefined}
        aria-describedby={props.error ? `${id}-error` : props.hint ? `${id}-hint` : undefined}
        className={`w-full h-9 px-3 text-sm rounded-lg border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40 ${
          props.error
            ? "border-danger focus:border-danger"
            : "border-border focus:border-accent"
        }`}
      />
      {props.error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger" role="alert">
          {props.error}
        </p>
      )}
      {!props.error && props.hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-fg-subtle">
          {props.hint}
        </p>
      )}
    </div>
  );
}
