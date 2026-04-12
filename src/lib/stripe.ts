import Stripe from "stripe";
import type { PlanTier } from "./types";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY?.trim();
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  price: number;
  interval: "month";
  features: string[];
  emailsPerMonth: number;
  aiTriagesPerMonth: number;
  highlighted?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    interval: "month",
    emailsPerMonth: 25,
    aiTriagesPerMonth: 25,
    features: [
      "25 emails / month",
      "AI triage & follow-ups",
      "Basic CRM (clients + jobs)",
      "Email notifications",
    ],
  },
  {
    tier: "starter",
    name: "Starter",
    price: 29,
    interval: "month",
    emailsPerMonth: 250,
    aiTriagesPerMonth: 250,
    highlighted: true,
    features: [
      "250 emails / month",
      "AI triage & follow-ups",
      "Full CRM with job costing",
      "Calendar invites (.ics)",
      "Email threading",
      "Priority support",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 79,
    interval: "month",
    emailsPerMonth: -1,
    aiTriagesPerMonth: -1,
    features: [
      "Unlimited emails",
      "Unlimited AI triages",
      "Everything in Starter",
      "Custom AI budget controls",
      "Stripe invoice tracking",
      "Dedicated onboarding",
    ],
  },
];

export function getPlanByTier(tier: PlanTier): PlanDefinition {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

export function priceToPlanTier(priceId: string): PlanTier {
  const starterPriceId = process.env.STRIPE_STARTER_PRICE_ID;
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  if (priceId === starterPriceId) return "starter";
  if (priceId === proPriceId) return "pro";
  return "free";
}
