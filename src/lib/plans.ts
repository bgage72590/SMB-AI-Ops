import type { PlanTier, User } from "./types";
import { getPlanByTier } from "./stripe";
import { listEmails } from "./store";

const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
};

export type Feature =
  | "job_costing"
  | "calendar_ics"
  | "email_threading"
  | "calendar_sync"
  | "sms_followups"
  | "pipeline_reports"
  | "lead_enrichment"
  | "slack_integration"
  | "chat_widget"
  | "ask_box";

/**
 * The tier an account gets right now. A live subscription gets what it
 * pays for; a running trial gets everything (Pro); anyone else is on the
 * Free plan. A lapsed trial is not locked out, it's just Free.
 */
export function effectiveTier(user: User): PlanTier {
  const tier = user.planTier ?? "free";
  const lapsed = ["canceled", "unpaid", "incomplete"].includes(user.subscriptionStatus ?? "");
  if (tier !== "free" && !lapsed) return tier;
  if (user.trialEndsAt && new Date(user.trialEndsAt).getTime() > Date.now()) return "pro";
  return "free";
}

/** The cheapest tier that includes a feature, for upgrade prompts. */
export function tierForFeature(feature: Feature): PlanTier {
  for (const tier of ["free", "starter", "pro"] as const) {
    if (hasFeature({ planTier: tier } as User, feature)) return tier;
  }
  return "pro";
}

export function hasFeature(user: User, feature: Feature): boolean {
  const tier = effectiveTier(user);
  switch (feature) {
    case "job_costing":
    case "calendar_ics":
    case "email_threading":
    case "sms_followups":
    case "calendar_sync":
      return TIER_RANK[tier] >= TIER_RANK.starter;
    case "pipeline_reports":
    case "ask_box":
    case "chat_widget":
      return TIER_RANK[tier] >= TIER_RANK.starter;
    case "lead_enrichment":
    case "slack_integration":
      return TIER_RANK[tier] >= TIER_RANK.pro;
  }
}

export type PaidKind = "ai" | "email" | "sms" | "enrichment";

/**
 * Paid-provider calls each account may make per UTC day. These cap what
 * one account can cost the operator; -1 is unlimited, 0 is none. SMS and
 * enrichment are also feature-gated (Starter / Pro).
 */
export const DAILY_LIMITS: Record<PlanTier, Record<PaidKind, number>> = {
  free: { ai: 60, email: 20, sms: 0, enrichment: 0 },
  starter: { ai: 600, email: 200, sms: 100, enrichment: 0 },
  pro: { ai: 2000, email: 1000, sms: 400, enrichment: 300 },
};

/** A trial gets Pro features but its own, smaller quotas: trials are free to create. */
export const TRIAL_DAILY_LIMITS: Record<PaidKind, number> = { ai: 300, email: 50, sms: 25, enrichment: 50 };

export function dailyLimit(user: User, kind: PaidKind): number {
  const tier = effectiveTier(user);
  const paying = (user.planTier ?? "free") === tier && tier !== "free";
  if (tier === "pro" && !paying) return TRIAL_DAILY_LIMITS[kind];
  return DAILY_LIMITS[tier][kind];
}

export interface UsageLimits {
  emailsUsed: number;
  emailsLimit: number;
  emailsRemaining: number;
  overLimit: boolean;
}

export function checkUsageLimits(user: User): UsageLimits {
  const plan = getPlanByTier(effectiveTier(user));
  if (plan.emailsPerMonth < 0) {
    return { emailsUsed: 0, emailsLimit: -1, emailsRemaining: -1, overLimit: false };
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const emails = listEmails(user.id).filter(
    (e) => e.receivedAt >= thirtyDaysAgo
  );
  const used = emails.length;
  const remaining = Math.max(0, plan.emailsPerMonth - used);

  return {
    emailsUsed: used,
    emailsLimit: plan.emailsPerMonth,
    emailsRemaining: remaining,
    overLimit: used >= plan.emailsPerMonth,
  };
}
