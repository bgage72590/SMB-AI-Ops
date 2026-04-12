import Link from "next/link";
import { ProcessButton } from "@/components/ProcessButton";
import { FollowUpActions } from "@/components/FollowUpActions";
import { InboundAddressCard } from "@/components/InboundAddressCard";
import {
  CategoryBadge,
  PriorityBadge,
  StageBadge,
} from "@/components/Badge";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
import {
  getContact,
  listContacts,
  listDeals,
  listEmails,
  listFollowUps,
  sumAiUsageSince,
} from "@/lib/store";
import { formatCurrency, formatRelative, formatUsdFine } from "@/lib/format";
import { isAIConfigured } from "@/lib/ai";
import { checkAiBudget } from "@/lib/aiUsage";
import { isPostmarkConfigured } from "@/lib/postmark";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const user = requireUser();
  const emails = listEmails(user.id);
  const deals = listDeals(user.id);
  const contacts = listContacts(user.id);
  const followUps = listFollowUps(user.id);
  const canSend = isPostmarkConfigured();

  const unprocessed = emails.filter((e) => !e.processed);
  const openDeals = deals.filter(
    (d) => d.stage !== "completed" && d.stage !== "lost"
  );
  const openPipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);
  const pendingDrafts = followUps.filter((f) => f.status === "draft");

  // "Booked this week" — completed jobs whose lastActivityAt is in the
  // last 7 days. Clean directional metric for a local service business.
  const weekAgo = Date.now() - WEEK_MS;
  const completedThisWeek = deals
    .filter((d) => d.stage === "completed")
    .filter((d) => new Date(d.lastActivityAt).getTime() >= weekAgo);
  const bookedThisWeek = completedThisWeek.reduce((sum, d) => sum + d.amount, 0);
  const profitThisWeek = completedThisWeek.reduce(
    (sum, d) => sum + (d.amount - d.costMaterials - d.costLabor),
    0
  );

  const newClientsThisWeek = contacts.filter(
    (c) => new Date(c.createdAt).getTime() >= weekAgo
  ).length;

  const weekAgoIso = new Date(weekAgo).toISOString();
  const aiUsage = sumAiUsageSince(user.id, weekAgoIso);
  const aiBudget = checkAiBudget(user.id);

  // "AI just did this" — emails the pipeline has already triaged,
  // freshest first, with the chip + one-liner summary.
  const recentlyTriaged = emails
    .filter((e) => e.processed)
    .slice()
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))
    .slice(0, 5);

  const hotJobs = openDeals
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  const firstName = user.name.split(" ")[0] || user.name;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // The hero "needs you right now" count rolls up every category of
  // owner attention into one number so the owner sees a clear
  // "X items are waiting on me" the moment they log in.
  const needsYouCount = unprocessed.length + pendingDrafts.length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting}, ${firstName}`}
        description="Here's what's waiting on you and what the AI already handled."
        actions={<ProcessButton />}
      />

      {!isAIConfigured() && (
        <Card className="p-4 border-warning/40 bg-warning-soft">
          <p className="text-sm text-fg">
            <strong>Heads up:</strong> <code>ANTHROPIC_API_KEY</code> is not
            set, so email triage and follow-up drafting are running in
            heuristic fallback mode. Copy <code>.env.example</code> to{" "}
            <code>.env</code> and add your key to enable real AI.
          </p>
        </Card>
      )}

      {user.inboundAddress && (
        <InboundAddressCard address={user.inboundAddress} />
      )}

      {aiBudget.budgetUsd > 0 && aiBudget.exceeded && (
        <Card className="p-4 border-danger/40 bg-danger-soft">
          <p className="text-sm text-fg">
            <strong>AI budget exceeded.</strong> You've spent{" "}
            {formatUsdFine(aiBudget.spentUsd)} of your{" "}
            {formatUsdFine(aiBudget.budgetUsd)}/week budget. The platform is
            running in heuristic fallback mode until next week's window opens.
          </p>
        </Card>
      )}

      {aiBudget.budgetUsd > 0 &&
        !aiBudget.exceeded &&
        aiBudget.warningPct >= 80 && (
          <Card className="p-4 border-warning/40 bg-warning-soft">
            <p className="text-sm text-fg">
              <strong>Heads up:</strong> You've used {aiBudget.warningPct}% of
              your {formatUsdFine(aiBudget.budgetUsd)}/week AI budget (
              {formatUsdFine(aiBudget.spentUsd)} spent,{" "}
              {formatUsdFine(aiBudget.remaining)} left).
            </p>
          </Card>
        )}

      {/* Hero: what needs the owner's attention right now. */}
      <Card className="overflow-hidden">
        <div className="grid md:grid-cols-[auto,1fr] items-center gap-6 p-6">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold">
              Waiting on you
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-5xl font-semibold text-fg tabular-nums">
                {needsYouCount}
              </span>
              <span className="text-sm text-fg-muted">
                {needsYouCount === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="text-xs text-fg-subtle mt-1">
              {needsYouCount === 0
                ? "Inbox zero. Nice."
                : "Across your inbox and drafts."}
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <HeroTile
              label="Unread emails"
              value={unprocessed.length}
              href="/inbox"
              cta={unprocessed.length > 0 ? "Triage" : "Open inbox"}
            />
            <HeroTile
              label="Drafts to approve"
              value={pendingDrafts.length}
              href="/followups"
              cta={pendingDrafts.length > 0 ? "Review" : "No drafts"}
            />
            <HeroTile
              label="New inquiries"
              value={
                emails.filter(
                  (e) =>
                    e.category === "new_lead" &&
                    new Date(e.receivedAt).getTime() >= weekAgo
                ).length
              }
              href="/inbox"
              cta="See details"
            />
          </div>
        </div>
      </Card>

      {/* At-a-glance stats. */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Booked this week"
          value={formatCurrency(bookedThisWeek)}
          hint={completedThisWeek.length > 0 ? `${formatCurrency(profitThisWeek)} profit · ${newClientsThisWeek} new client${newClientsThisWeek === 1 ? "" : "s"}` : `${newClientsThisWeek} new client${newClientsThisWeek === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Open job value"
          value={formatCurrency(openPipelineValue)}
          hint={`${openDeals.length} open job${openDeals.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Pending follow-ups"
          value={pendingDrafts.length}
          hint="drafts awaiting approval"
        />
        <StatCard
          label="Clients"
          value={contacts.length}
          hint="in your book"
        />
        <StatCard
          label="AI spend · 7d"
          value={formatUsdFine(aiUsage.totalCostUsd)}
          hint={
            aiBudget.budgetUsd > 0
              ? `${aiBudget.warningPct}% of ${formatUsdFine(aiBudget.budgetUsd)} budget`
              : `${aiUsage.calls} AI call${aiUsage.calls === 1 ? "" : "s"}`
          }
        />
      </section>

      {/* Two-column: drafts needing approval + AI activity feed. */}
      <section className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Needs your approval"
            subtitle={`${pendingDrafts.length} ${
              pendingDrafts.length === 1 ? "draft" : "drafts"
            } from the AI`}
            action={
              pendingDrafts.length > 0 ? (
                <Link
                  href="/followups"
                  className="text-xs text-accent hover:underline"
                >
                  See all
                </Link>
              ) : undefined
            }
          />
          <CardBody>
            {pendingDrafts.length === 0 ? (
              <EmptyState
                icon="✓"
                title="You're caught up"
                description="No drafts waiting. New ones appear here when the AI triages inbound mail."
              />
            ) : (
              <ul className="space-y-3">
                {pendingDrafts.slice(0, 3).map((f) => {
                  const contact = getContact(user.id, f.contactId);
                  return (
                    <li
                      key={f.id}
                      className="rounded-lg border border-border bg-surface-2/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-fg-subtle">
                            To: {contact?.name || "Unknown"}
                          </div>
                          <div className="font-medium text-fg text-sm mt-0.5 truncate">
                            {f.subject}
                          </div>
                          <div className="text-xs text-fg-muted mt-1 line-clamp-2 italic">
                            {f.reason}
                          </div>
                        </div>
                        <FollowUpActions
                          id={f.id}
                          currentStatus={f.status}
                          canSend={canSend}
                          sentAt={f.sentAt}
                          hasIcs={!!f.icsData}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="AI just did this"
            subtitle="Recent inbox triage activity"
            action={
              <Link
                href="/inbox"
                className="text-xs text-accent hover:underline"
              >
                Open inbox
              </Link>
            }
          />
          <CardBody>
            {recentlyTriaged.length === 0 ? (
              <EmptyState
                icon="✨"
                title="Nothing to show yet"
                description="Once the AI processes an email, the activity will show up here."
                action={<ProcessButton label="Process inbox now" />}
              />
            ) : (
              <ul className="space-y-3">
                {recentlyTriaged.map((email) => (
                  <li
                    key={email.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {email.category && (
                          <CategoryBadge category={email.category} />
                        )}
                        {email.priority && (
                          <PriorityBadge priority={email.priority} />
                        )}
                      </div>
                      <div className="text-sm font-medium text-fg mt-1 truncate">
                        {email.fromName || email.from}
                      </div>
                      <div className="text-xs text-fg-muted truncate">
                        {email.summary || email.subject}
                      </div>
                    </div>
                    <span className="text-[11px] text-fg-subtle whitespace-nowrap">
                      {formatRelative(email.receivedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>

      {/* Top open jobs. */}
      <Card>
        <CardHeader
          title="Top open jobs"
          subtitle="Highest-value work still in the pipeline"
          action={
            <Link href="/deals" className="text-xs text-accent hover:underline">
              View pipeline
            </Link>
          }
        />
        <CardBody>
          {hotJobs.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No open jobs yet"
              description="Jobs appear here as the AI books appointments and tracks work through the pipeline."
              action={
                <Link
                  href="/deals"
                  className="inline-flex items-center justify-center h-8 px-3 text-xs rounded-lg bg-surface text-fg border border-border hover:bg-surface-2 transition-colors"
                >
                  Open pipeline
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {hotJobs.map((deal) => {
                const contact = getContact(user.id, deal.contactId);
                return (
                  <li
                    key={deal.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StageBadge stage={deal.stage} />
                        <Link
                          href={`/deals/${deal.id}`}
                          className="font-medium text-fg truncate hover:text-accent"
                        >
                          {deal.title}
                        </Link>
                      </div>
                      <div className="text-xs text-fg-subtle mt-1">
                        {contact?.name || "Unknown client"}
                      </div>
                      {deal.nextStep && (
                        <div className="text-xs text-fg-muted mt-1">
                          Next: {deal.nextStep}
                        </div>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="font-semibold text-fg tabular-nums">
                        {formatCurrency(deal.amount, deal.currency)}
                      </div>
                      <div className="text-[11px] text-fg-subtle">
                        {formatRelative(deal.lastActivityAt)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// Small tile used inside the hero card. Click-through to the right
// page with a lightweight "cta" label on the right.
function HeroTile({
  label,
  value,
  href,
  cta,
}: {
  label: string;
  value: number;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 hover:border-accent/40 transition px-4 py-3"
    >
      <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold">
        {label}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold text-fg tabular-nums">
          {value}
        </span>
        <Chip tone={value > 0 ? "accent" : "neutral"}>{cta}</Chip>
      </div>
    </Link>
  );
}
