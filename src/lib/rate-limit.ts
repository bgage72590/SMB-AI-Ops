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
 * The client IP as seen by our own reverse proxy.
 *
 * X-Forwarded-For is a list each proxy appends to, so only the entries
 * our proxies added can be trusted; anything to their left was sent by
 * the client and can be anything. With TRUSTED_PROXY_HOPS proxies in
 * front of the app (default 1: Caddy, see docs/deployment.md) the client
 * is the entry that many places from the right.
 */
export function getClientIp(request: Request): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  const chain = (request.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length > 0) return chain[Math.max(0, chain.length - hops)];
  return request.headers.get("x-real-ip") || "unknown";
}
