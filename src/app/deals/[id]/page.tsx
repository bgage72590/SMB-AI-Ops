import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CategoryBadge,
  PriorityBadge,
  StageBadge,
} from "@/components/Badge";
import { Breadcrumb } from "@/components/Breadcrumb";
import {
  getContact,
  getDeal,
  listEmailsForDeal,
  listFollowUpsForDeal,
} from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { StageChanger } from "@/components/StageChanger";
import type { Email, FollowUp } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

type TimelineEntry =
  | { kind: "email"; at: string; email: Email }
  | { kind: "followup"; at: string; followUp: FollowUp }
  | { kind: "stage"; at: string; label: string };

export default function JobDetailPage({ params }: Props) {
  const user = requireUser();
  const deal = getDeal(user.id, params.id);
  if (!deal) notFound();

  const contact = getContact(user.id, deal.contactId);
  const emails = listEmailsForDeal(user.id, deal.id);
  const followUps = listFollowUpsForDeal(user.id, deal.id);

  const totalCost = deal.costMaterials + deal.costLabor;
  const profit = deal.amount - totalCost;
  const marginPct = deal.amount > 0 ? Math.round((profit / deal.amount) * 100) : 0;

  const timeline: TimelineEntry[] = [
    {
      kind: "stage",
      at: deal.createdAt,
      label: `Job created as ${deal.stage.replace("_", " ")}`,
    },
    ...emails.map<TimelineEntry>((email) => ({
      kind: "email",
      at: email.receivedAt,
      email,
    })),
    ...followUps.map<TimelineEntry>((followUp) => ({
      kind: "followup",
      at: followUp.createdAt,
      followUp,
    })),
  ];
  if (deal.updatedAt !== deal.createdAt) {
    timeline.push({
      kind: "stage",
      at: deal.updatedAt,
      label: `Last activity &middot; ${deal.stage.replace("_", " ")}`,
    });
  }
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Jobs", href: "/deals" },
          { label: deal.title },
        ]}
      />

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-[340px,1fr] gap-6">
        {/* Left: job info */}
        <div className="space-y-4">
          {/* Header card */}
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <StageChanger dealId={deal.id} currentStage={deal.stage} />
              <span className="text-2xl font-semibold text-fg tabular-nums">
                {formatCurrency(deal.amount, deal.currency)}
              </span>
            </div>

            <h1 className="text-lg font-semibold text-fg">{deal.title}</h1>

            {contact && (
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent text-[10px] font-bold shrink-0">
                  {contact.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="text-sm text-fg hover:text-accent transition-colors"
                  >
                    {contact.name}
                  </Link>
                  {contact.company && (
                    <span className="text-xs text-fg-subtle ml-1.5">{contact.company}</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-3 text-xs text-fg-subtle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Opened {formatRelative(deal.createdAt)} &middot; Updated {formatRelative(deal.updatedAt)}</span>
            </div>

            {contact && (
              <div className="flex items-center gap-3 mt-2 text-xs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-subtle shrink-0">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <a href={`mailto:${contact.email}`} className="text-fg-muted hover:text-accent transition-colors truncate">
                  {contact.email}
                </a>
              </div>
            )}
          </div>

          {/* Next step */}
          {deal.nextStep && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium mb-1.5">Next step</div>
              <p className="text-sm text-fg">{deal.nextStep}</p>
            </div>
          )}

          {/* Financials */}
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="text-xs font-semibold text-fg">Financials</div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border">
              <div className="bg-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Revenue</div>
                <div className="text-lg font-semibold text-fg tabular-nums mt-0.5">{formatCurrency(deal.amount, deal.currency)}</div>
              </div>
              <div className="bg-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Profit</div>
                <div className={`text-lg font-semibold tabular-nums mt-0.5 ${profit >= 0 ? "text-success" : "text-danger"}`}>
                  {formatCurrency(profit, deal.currency)}
                </div>
                <div className="text-[10px] text-fg-subtle">{marginPct}% margin</div>
              </div>
              <div className="bg-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Materials</div>
                <div className="text-sm font-semibold text-fg tabular-nums mt-0.5">{formatCurrency(deal.costMaterials, deal.currency)}</div>
              </div>
              <div className="bg-surface p-3">
                <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Labor</div>
                <div className="text-sm font-semibold text-fg tabular-nums mt-0.5">{formatCurrency(deal.costLabor, deal.currency)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: activity timeline */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-fg">Activity</h2>
            <span className="text-xs text-fg-subtle">{timeline.length} event{timeline.length === 1 ? "" : "s"}</span>
          </div>

          {timeline.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-subtle">
              No activity yet &mdash; emails and follow-ups will appear here as the job progresses.
            </div>
          ) : (
            <ol className="relative border-l-2 border-border ml-2 space-y-3">
              {timeline.map((entry, idx) => (
                <li key={idx} className="ml-5 relative">
                  <TimelineDot kind={entry.kind} />
                  <TimelineRow entry={entry} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineDot({ kind }: { kind: string }) {
  const color =
    kind === "email"
      ? "bg-info"
      : kind === "followup"
        ? "bg-accent"
        : "bg-fg-subtle";
  return (
    <span
      className={`absolute -left-[25px] top-3 h-2.5 w-2.5 rounded-full ${color} ring-3 ring-bg`}
    />
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "stage") {
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-fg-subtle font-medium">Stage change</span>
          <span className="text-[11px] text-fg-subtle">{formatRelative(entry.at)}</span>
        </div>
        <div className="text-sm text-fg-muted mt-1">{entry.label}</div>
      </div>
    );
  }
  if (entry.kind === "email") {
    const email = entry.email;
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-info font-medium">Email</span>
            {email.category && <CategoryBadge category={email.category} />}
            {email.priority && <PriorityBadge priority={email.priority} />}
          </div>
          <span className="text-[11px] text-fg-subtle">{formatRelative(email.receivedAt)}</span>
        </div>
        <div className="text-sm font-medium text-fg mt-1">{email.subject}</div>
        <div className="text-xs text-fg-muted mt-0.5">from {email.fromName || email.from}</div>
        {email.summary && email.summary !== email.subject && (
          <div className="text-xs text-fg-subtle mt-1.5 italic line-clamp-2">{email.summary}</div>
        )}
      </div>
    );
  }
  const followUp = entry.followUp;
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-accent font-medium">Follow-up</span>
          <span className={`text-[10px] uppercase tracking-wide font-medium ${
            followUp.status === "sent" ? "text-success" :
            followUp.status === "dismissed" ? "text-fg-subtle" :
            "text-warning"
          }`}>
            {followUp.status}
          </span>
        </div>
        <span className="text-[11px] text-fg-subtle">{formatRelative(followUp.createdAt)}</span>
      </div>
      <div className="text-sm font-medium text-fg mt-1">{followUp.subject}</div>
      <div className="text-xs text-fg-muted mt-0.5 line-clamp-2">{followUp.reason}</div>
    </div>
  );
}
