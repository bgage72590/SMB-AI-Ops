// Simple in-memory rate limiter keyed by IP address. Designed for auth
// endpoints (login, signup, password reset) to prevent brute-force attacks.
//
// Stores counters in a Map with automatic expiry. When the app is behind
// multiple serverless instances each gets its own Map — that's fine for
// a single-node SMB deployment. Move to Redis for horizontal scaling.

interface Window {
  count: number;
  expiresAt: number;
}

const store = new Map<string, Window>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, window] of store) {
    if (window.expiresAt <= now) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check and increment the rate limit for a given key.
 *
 * @param key      Unique identifier (e.g. IP address or "login:1.2.3.4")
 * @param max      Maximum requests per window (default: 10)
 * @param windowMs Window size in milliseconds (default: 15 minutes)
 */
export function checkRateLimit(
  key: string,
  max = 10,
  windowMs = 15 * 60 * 1000
): RateLimitResult {
  cleanup();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.expiresAt <= now) {
    store.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
  }

  existing.count++;
  if (existing.count > max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: existing.expiresAt - now,
    };
  }

  return {
    allowed: true,
    remaining: max - existing.count,
    retryAfterMs: 0,
  };
}

/**
 * Extract the client IP from a Next.js Request. Checks common proxy
 * headers in order of trust, falling back to "unknown".
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
