"use client";

import { useState } from "react";
import { Button } from "./ui";
import type { PlanTier } from "@/lib/types";

interface Props {
  action: "checkout" | "portal";
  planTier?: PlanTier;
}

const TRUSTED_REDIRECT_DOMAINS = [
  "checkout.stripe.com",
  "billing.stripe.com",
];

function isAllowedRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    return TRUSTED_REDIRECT_DOMAINS.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

const PRICE_ENV: Record<string, string | undefined> = {};

export function BillingActions({ action, planTier }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId: getPriceId(planTier) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const { url } = await response.json();
      if (url && isAllowedRedirect(url)) window.location.href = url;
      else if (url) throw new Error("Unexpected redirect URL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePortal() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const { url } = await response.json();
      if (url && isAllowedRedirect(url)) window.location.href = url;
      else if (url) throw new Error("Unexpected redirect URL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setLoading(false);
    }
  }

  if (action === "portal") {
    return (
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handlePortal}
          loading={loading}
          disabled={loading}
        >
          Manage billing
        </Button>
        {error && (
          <span className="text-[11px] text-danger">{error}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={planTier === "pro" ? "secondary" : "primary"}
        size="sm"
        onClick={handleCheckout}
        loading={loading}
        disabled={loading}
      >
        {loading ? "Redirecting…" : `Upgrade to ${planTier === "pro" ? "Pro" : "Starter"}`}
      </Button>
      {error && (
        <span className="text-[11px] text-danger">{error}</span>
      )}
    </div>
  );
}

function getPriceId(tier?: PlanTier): string {
  if (tier === "starter") return process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "price_starter";
  if (tier === "pro") return process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "price_pro";
  return "price_free";
}
