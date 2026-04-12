import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getUserById } from "@/lib/store";
import { PLANS, isStripeConfigured } from "@/lib/stripe";
import { checkUsageLimits } from "@/lib/plans";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui";
import { BillingActions } from "@/components/BillingActions";
import { InboundAddressCard } from "@/components/InboundAddressCard";

export default function SettingsPage() {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const fresh = getUserById(user.id);
  if (!fresh) redirect("/login");

  const stripeReady = isStripeConfigured();
  const usage = checkUsageLimits(fresh);
  const currentPlan = PLANS.find((p) => p.tier === fresh.planTier) ?? PLANS[0];

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account and billing"
      />

      {/* Inbound address */}
      {fresh.inboundAddress && (
        <InboundAddressCard address={fresh.inboundAddress} />
      )}

      {/* Current plan */}
      <Card>
        <CardHeader title="Current plan" />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{currentPlan.name}</span>
            {fresh.subscriptionStatus === "active" && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                Active
              </span>
            )}
            {fresh.subscriptionStatus === "past_due" && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-danger/10 text-danger">
                Past due
              </span>
            )}
            {fresh.planTier === "free" && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 text-fg-muted">
                Free tier
              </span>
            )}
          </div>

          {usage.emailsLimit > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-fg-muted">Emails this month</span>
                <span className="font-medium">
                  {usage.emailsUsed} / {usage.emailsLimit}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.overLimit ? "bg-danger" : "bg-accent"
                  }`}
                  style={{
                    width: `${Math.min(100, (usage.emailsUsed / usage.emailsLimit) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {usage.emailsLimit < 0 && (
            <p className="text-sm text-fg-muted">
              Unlimited emails and AI triages
            </p>
          )}

          <ul className="text-sm text-fg-muted space-y-1">
            {currentPlan.features.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="text-success">&#10003;</span> {f}
              </li>
            ))}
          </ul>

          {stripeReady && fresh.stripeCustomerId && (
            <BillingActions action="portal" />
          )}
        </CardBody>
      </Card>

      {/* Quick links */}
      <Card>
        <CardHeader title="More settings" />
        <CardBody>
          <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/settings/usage"
              className="rounded-lg border border-border p-4 hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <h3 className="font-medium text-sm text-fg">AI Usage</h3>
              <p className="text-xs text-fg-muted mt-1">
                Token counts, costs, and recent AI calls
              </p>
            </Link>
            <Link
              href="/settings/privacy"
              className="rounded-lg border border-border p-4 hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <h3 className="font-medium text-sm text-fg">Privacy</h3>
              <p className="text-xs text-fg-muted mt-1">
                Sender blocklist and data controls
              </p>
            </Link>
            <Link
              href="/settings/audit"
              className="rounded-lg border border-border p-4 hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <h3 className="font-medium text-sm text-fg">Audit log</h3>
              <p className="text-xs text-fg-muted mt-1">
                Timeline of every AI action
              </p>
            </Link>
            <Link
              href="/settings/calendar"
              className="rounded-lg border border-border p-4 hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <h3 className="font-medium text-sm text-fg">Calendar</h3>
              <p className="text-xs text-fg-muted mt-1">
                Google Calendar for smart scheduling
              </p>
            </Link>
            <Link
              href="/settings/team"
              className="rounded-lg border border-border p-4 hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <h3 className="font-medium text-sm text-fg">Team</h3>
              <p className="text-xs text-fg-muted mt-1">
                Invite a second owner to your workspace
              </p>
            </Link>
            <Link
              href="/settings/domain"
              className="rounded-lg border border-border p-4 hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <h3 className="font-medium text-sm text-fg">Domain</h3>
              <p className="text-xs text-fg-muted mt-1">
                Verify SPF, DKIM &amp; DMARC for deliverability
              </p>
            </Link>
            <Link
              href="/settings/widget"
              className="rounded-lg border border-border p-4 hover:border-accent hover:bg-accent/5 transition-colors"
            >
              <h3 className="font-medium text-sm text-fg">Chat widget</h3>
              <p className="text-xs text-fg-muted mt-1">
                Embed a lead capture form on your website
              </p>
            </Link>
          </nav>
        </CardBody>
      </Card>

      {/* Upgrade / Plans */}
      {fresh.planTier !== "pro" && (
        <Card>
          <CardHeader title="Upgrade your plan" />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              {PLANS.filter((p) => p.price > 0).map((plan) => {
                const isCurrent = plan.tier === fresh.planTier;
                return (
                  <div
                    key={plan.tier}
                    className={`rounded-lg border p-4 flex flex-col gap-3 ${
                      plan.highlighted
                        ? "border-accent ring-1 ring-accent"
                        : "border-border"
                    } ${isCurrent ? "bg-surface-2" : ""}`}
                  >
                    <div>
                      <h3 className="font-semibold">{plan.name}</h3>
                      <p className="text-2xl font-bold mt-1">
                        ${plan.price}
                        <span className="text-sm font-normal text-fg-muted">
                          /mo
                        </span>
                      </p>
                    </div>
                    <ul className="text-sm text-fg-muted space-y-1 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <span className="text-success">&#10003;</span> {f}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <span className="text-center text-sm text-fg-muted py-2">
                        Current plan
                      </span>
                    ) : stripeReady ? (
                      <BillingActions action="checkout" planTier={plan.tier} />
                    ) : (
                      <span className="text-center text-xs text-fg-subtle py-2">
                        Set STRIPE_SECRET_KEY to enable billing
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </main>
  );
}
