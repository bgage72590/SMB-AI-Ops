// Tiny helper for guarding cron-style API routes. We accept either a
// Bearer header or a ?secret= query param so the route works with every
// common scheduler (Vercel cron sends a Bearer, GitHub Actions can do
// either, a plain `curl` either works too).
//
// If CRON_SECRET is not configured at all, the route is left wide open
// in development only — in production we fail closed so nothing can
// trigger it by accident.

import crypto from "node:crypto";

function constantEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Dev ergonomics: if no secret is configured, only allow from the
    // loopback so local smoke tests still work but prod never lets
    // random callers in.
    if (process.env.NODE_ENV !== "production") return true;
    return false;
  }

  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ") && constantEq(auth.slice(7), expected)) {
    return true;
  }
  const url = new URL(request.url);
  const token = url.searchParams.get("secret");
  if (token && constantEq(token, expected)) return true;

  return false;
}
