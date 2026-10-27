// The enforcement layer. Two entry points, one set of rules:
//
//   apiRoute()   wraps every signed-in API route that writes or costs money.
//                It resolves the user (401), checks the plan feature (403)
//                and a per-account rate limit (429), then runs the handler.
//                guard-coverage.test.ts fails if a write route skips it.
//
//   chargePaid() gates every call to a paid provider (Anthropic, SendGrid,
//                Twilio, enrichment). It needs a verified email and room in
//                the account's daily plan quota, and counts the call. Routes
//                call it right before sending; background work (inbound mail,
//                the scheduler) uses tryChargePaid() and degrades instead.
//
// Plans: a running trial gets Pro features with trial quotas; a lapsed
// trial is the Free plan, not a locked account. See plans.ts.

import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "./auth";
import { checkRateLimit } from "./rate-limit";
import {
  dailyLimit,
  hasFeature,
  tierForFeature,
  type Feature,
  type PaidKind,
} from "./plans";
import { getUserById, tryConsumeUsage } from "./store";
import type { User } from "./types";

export class GuardError extends Error {
  constructor(
    public code: "plan_required" | "email_unverified" | "quota_exceeded" | "rate_limited",
    public status: number,
    message: string,
    public retryAfterMs?: number
  ) {
    super(message);
  }
}

const PAID_LABEL: Record<PaidKind, string> = {
  ai: "AI calls",
  email: "emails",
  sms: "text messages",
  enrichment: "lead lookups",
};

export function requireFeature(user: User, feature: Feature): void {
  if (!hasFeature(user, feature)) {
    const tier = tierForFeature(feature);
    throw new GuardError(
      "plan_required",
      403,
      `This needs the ${tier[0].toUpperCase()}${tier.slice(1)} plan. Upgrade under Settings.`
    );
  }
}

/** Gate one paid-provider call. Throws GuardError when denied; counts it when allowed. */
export function chargePaid(user: User, kind: PaidKind): void {
  if (!user.emailVerifiedAt) {
    throw new GuardError(
      "email_unverified",
      403,
      "Verify your email address to turn on AI, sending and texting."
    );
  }
  const limit = dailyLimit(user, kind);
  if (limit === 0) {
    throw new GuardError("plan_required", 403, `Your plan doesn't include ${PAID_LABEL[kind]}.`);
  }
  if (!tryConsumeUsage(user.id, kind, limit)) {
    throw new GuardError(
      "quota_exceeded",
      429,
      `You've used today's ${limit} ${PAID_LABEL[kind]}. The limit resets at midnight UTC.`
    );
  }
}

/**
 * chargePaid for background work: returns false instead of throwing, so
 * the caller can fall back (heuristic triage, skip enrichment).
 */
export function tryChargePaid(userOrId: User | string, kind: PaidKind): boolean {
  const user = typeof userOrId === "string" ? getUserById(userOrId) : userOrId;
  if (!user) return false;
  try {
    chargePaid(user, kind);
    return true;
  } catch (err) {
    if (err instanceof GuardError) return false;
    throw err;
  }
}

export interface RateRule {
  /** Separate counters per bucket, e.g. "sms" vs the default "write". */
  bucket: string;
  max: number;
  windowMs: number;
}

export interface RouteOptions {
  feature?: Feature;
  /** Per-account rate limit. Defaults to 120 requests a minute. */
  rate?: RateRule;
}

const DEFAULT_RATE: RateRule = { bucket: "write", max: 120, windowMs: 60_000 };

export function errorResponse(err: AuthError | GuardError): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.code }, { status: err.status });
  }
  const headers: Record<string, string> = {};
  if (err.retryAfterMs) headers["Retry-After"] = String(Math.ceil(err.retryAfterMs / 1000));
  return NextResponse.json(
    { error: err.code, message: err.message, retryAfterMs: err.retryAfterMs },
    { status: err.status, headers }
  );
}

/** Resolve the signed-in user from the session, re-read so plan changes apply at once. */
async function currentUser(): Promise<User> {
  const sessionUser = await requireUserForApi();
  return getUserById(sessionUser.id) ?? sessionUser;
}

/** Wrap a signed-in API route handler with auth, plan, and rate checks. */
export function apiRoute(
  options: RouteOptions,
  handler: (request: Request, user: User) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      const user = await currentUser();
      if (options.feature) requireFeature(user, options.feature);

      const rate = options.rate ?? DEFAULT_RATE;
      const limit = checkRateLimit(`acct:${user.id}:${rate.bucket}`, rate.max, rate.windowMs);
      if (!limit.allowed) {
        throw new GuardError(
          "rate_limited",
          429,
          "Too many requests. Wait a moment and try again.",
          limit.retryAfterMs
        );
      }

      return await handler(request, user);
    } catch (err) {
      if (err instanceof AuthError || err instanceof GuardError) return errorResponse(err);
      throw err;
    }
  };
}
