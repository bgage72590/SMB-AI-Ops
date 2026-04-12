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
import { isEmailConfigured } from "@/lib/sendgrid";
import { requireUser } from "@/lib/auth";
import { checkTrial } from "@/lib/trial";
import { TrialBanner } from "@/components/TrialBanner";
import { AskBox } from "@/components/AskBox";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const user = requireUser();
  const emails = listEmails(user.id);
  const deals = listDeals(user.id);
  const contacts = listContacts(user.id);
  const followUps = listFollowUps(user.id);
  const canSend = isEmailConfigured();
  const trial = checkTrial(user);

  const unprocessed = emails.filter((e) => !e.processed);
  const openDeals = deals.filter(
    (d) => d.stage !== "completed" && d.stage !== "lost"
  );
  const openPipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);
  const pendingDrafts = followUps.filter((f) => f.status === "draft");

  const weekAgo = Date.now() - WEEK_MS;
  const completedThisWeek = deals
    .filter((d) => d.stage === "completed")
    .filter((d) => new Date(d.lastActivityAt).getTime() >= weekAgo);
  const bookedThisWeek = completedThisWeek.reduce((sum, d) => sum + d.amount, 0);

  const newClientsThisWeek = contacts.filter(
    (c) => new Date(c.createdAt).getTime() >= weekAgo
  ).length;

  const weekAgoIso = new Date(weekAgo).toISOString();
  const aiUsage = sumAiUsageSince(user.id, weekAgoIso);
  const aiBudget = checkAiBudget(user.id);

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

  const needsYouCount = unprocessed.length + pendingDrafts.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-fg-muted mt-0.5">
            {needsYouCount === 0
              ? "You're all caught up. Here's your business snapshot."
              : `${needsYouCount} item${needsYouCount === 1 ? "" : "s"} waiting on you.`}
          </p>
        </div>
        <ProcessButton />
      </div>

      <TrialBanner trial={trial} />

      {!isAIConfigured() && (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-fg">
          <strong>Heads up:</strong> <code>ANTHROPIC_API_KEY</code> is not set —
          email triage and follow-up drafting are running in heuristic fallback mode.
        </div>
      )}

      {aiBudget.budgetUsd > 0 && aiBudget.exceeded && (
        <div className="rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-fg">
          <strong>AI budget exceeded.</strong> You've spent{" "}
          {formatUsdFine(aiBudget.spentUsd)} of your{" "}
          {formatUsdFine(aiBudget.budgetUsd)}/week budget.
        </div>
      )}

      {aiBudget.budgetUsd > 0 &&
        !aiBudget.exceeded &&
        aiBudget.warningPct >= 80 && (
          <div className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-fg">
            <strong>Heads up:</strong> You've used {aiBudget.warningPct}% of your{" "}
            {formatUsdFine(aiBudget.budgetUsd)}/week AI budget.
          </div>
        )}

      {user.inboundAddress && (
        <div className="space-y-1.5">
          <InboundAddressCard address={user.inboundAddress} />
          {emails.filter((e) => e.processed).length === 0 && (
            <Link
              href="/onboarding"
              className="block text-center text-xs text-accent hover:underline"
            >
              Need help setting up Gmail forwarding? Follow the setup guide
            </Link>
          )}
        </div>
      )}

      {/* Stats grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          href={needsYouCount > 0 ? "/inbox" : "#"}
          className="group col-span-2 lg:col-span-1 rounded-xl border border-border bg-surface p-4 hover:border-accent/40 transition-colors shadow-[var(--shadow-card)]"
        >
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
            Waiting on you
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-accent tabular-nums">
              {needsYouCount}
            </span>
            <span className="text-xs text-fg-muted">
              {needsYouCount === 0 ? "all clear" : needsYouCount === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-fg-subtle">
            <span>{unprocessed.length} unread</span>
            <span className="w-px h-3 bg-border" />
            <span>{pendingDrafts.length} draft{pendingDrafts.length === 1 ? "" : "s"}</span>
          </div>
        </Link>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
            Booked this week
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-fg tabular-nums">
            {formatCurrency(bookedThisWeek)}
          </div>
          <div className="text-[11px] text-fg-subtle mt-1">
            {newClientsThisWeek} new client{newClientsThisWeek === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
            Open pipeline
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-fg tabular-nums">
            {formatCurrency(openPipelineValue)}
          </div>
          <div className="text-[11px] text-fg-subtle mt-1">
            {openDeals.length} active job{openDeals.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
            Clients
          </div>
          <div className="mt-1.5 text-2xl font-semibold text-fg tabular-nums">
            {contacts.length}
          </div>
          <div className="text-[11px] text-fg-subtle mt-1">
            {aiUsage.calls} AI call{aiUsage.calls === 1 ? "" : "s"} this week
          </div>
        </div>
      </section>

      {/* Two-column: drafts + activity feed */}
      <section className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Needs your approval"
            subtitle={
              pendingDrafts.length === 0
                ? "No pending drafts"
                : `${pendingDrafts.length} draft${pendingDrafts.length === 1 ? "" : "s"} ready for review`
            }
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
              <div className="flex items-center gap-3 py-4 px-1 text-sm text-fg-subtle">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success text-sm">
                  &#10003;
                </span>
                <span>All caught up — new drafts appear when the AI triages mail.</span>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {pendingDrafts.slice(0, 3).map((f) => {
                  const contact = getContact(user.id, f.contactId);
                  return (
                    <li
                      key={f.id}
                      className="rounded-lg border border-border bg-surface-2/50 p-3"
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
            title="AI activity"
            subtitle="Recent inbox triage"
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
              <div className="flex items-center gap-3 py-4 px-1 text-sm text-fg-subtle">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent text-sm">
                  &#9734;
                </span>
                <span>No activity yet — process your inbox to get started.</span>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentlyTriaged.map((email) => (
                  <li
                    key={email.id}
                    className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                    <span className="text-[11px] text-fg-subtle whitespace-nowrap mt-0.5">
                      {formatRelative(email.receivedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>

      {/* Ask AI — compact inline bar */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10 text-accent text-xs font-bold shrink-0">
            AI
          </span>
          <span className="text-sm font-medium text-fg">Ask your AI office manager</span>
        </div>
        <CardBody>
          <AskBox />
        </CardBody>
      </Card>

      {/* Top open jobs */}
      {hotJobs.length > 0 && (
        <Card>
          <CardHeader
            title="Top open jobs"
            subtitle={`${openDeals.length} active in pipeline`}
            action={
              <Link href="/deals" className="text-xs text-accent hover:underline">
                View pipeline
              </Link>
            }
          />
          <CardBody>
            <ul className="divide-y divide-border">
              {hotJobs.map((deal) => {
                const contact = getContact(user.id, deal.contactId);
                return (
                  <li
                    key={deal.id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <StageBadge stage={deal.stage} />
                      <div className="min-w-0">
                        <Link
                          href={`/deals/${deal.id}`}
                          className="text-sm font-medium text-fg truncate hover:text-accent transition-colors block"
                        >
                          {deal.title}
                        </Link>
                        <div className="text-xs text-fg-subtle truncate">
                          {contact?.name || "Unknown"}{deal.nextStep ? ` · ${deal.nextStep}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-fg tabular-nums">
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
          </CardBody>
        </Card>
      )}
    </div>
  );
}
