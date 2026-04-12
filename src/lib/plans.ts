import type { PlanTier, User } from "./types";
import { getPlanByTier } from "./stripe";
import { listEmails } from "./store";

const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
};

export function hasFeature(
  user: User,
  feature: "job_costing" | "calendar_ics" | "email_threading" | "ai_budget_controls"
): boolean {
  const tier = user.planTier ?? "free";
  switch (feature) {
    case "job_costing":
      return TIER_RANK[tier] >= TIER_RANK.starter;
    case "calendar_ics":
      return TIER_RANK[tier] >= TIER_RANK.starter;
    case "email_threading":
      return TIER_RANK[tier] >= TIER_RANK.starter;
    case "ai_budget_controls":
      return TIER_RANK[tier] >= TIER_RANK.pro;
  }
}

export interface UsageLimits {
  emailsUsed: number;
  emailsLimit: number;
  emailsRemaining: number;
  overLimit: boolean;
}

export function checkUsageLimits(user: User): UsageLimits {
  const plan = getPlanByTier(user.planTier ?? "free");
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
