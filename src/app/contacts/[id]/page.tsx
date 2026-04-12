import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CategoryBadge,
  PriorityBadge,
  StageBadge,
} from "@/components/Badge";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ContactEditForm } from "@/components/ContactEditForm";
import {
  getContact,
  listDealsForContact,
  listEmailsForContact,
  listFollowUpsForContact,
} from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import type { Email, FollowUp, Deal } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

type TimelineEntry =
  | { kind: "email"; at: string; email: Email }
  | { kind: "followup"; at: string; followUp: FollowUp }
  | { kind: "deal"; at: string; deal: Deal };

export default function ClientDetailPage({ params }: Props) {
  const user = requireUser();
  const contact = getContact(user.id, params.id);
  if (!contact) notFound();

  const deals = listDealsForContact(user.id, contact.id);
  const emails = listEmailsForContact(user.id, contact.id);
  const followUps = listFollowUpsForContact(user.id, contact.id);

  const openDeals = deals.filter(
    (d) => d.stage !== "completed" && d.stage !== "lost"
  );
  const pipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);
  const totalRevenue = deals
    .filter((d) => d.stage === "completed")
    .reduce((sum, d) => sum + d.amount, 0);

  const timeline: TimelineEntry[] = [
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
    ...deals.map<TimelineEntry>((deal) => ({
      kind: "deal",
      at: deal.createdAt,
      deal,
    })),
  ];
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Clients", href: "/contacts" },
          { label: contact.name },
        ]}
      />

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-[340px,1fr] gap-6">
        {/* Left: contact info card */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-accent/15 text-accent text-sm font-bold shrink-0">
                {contact.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-fg truncate">{contact.name}</h1>
                {contact.company && (
                  <div className="text-xs text-fg-muted">{contact.company}</div>
                )}
              </div>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-subtle shrink-0">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <a href={`mailto:${contact.email}`} className="text-fg-muted hover:text-accent transition-colors truncate">
                  {contact.email}
                </a>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-subtle shrink-0">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className="text-fg-muted tabular-nums">{contact.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-subtle shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-fg-subtle text-xs">Added {formatRelative(contact.createdAt)} &middot; Last touch {formatRelative(contact.updatedAt)}</span>
              </div>
            </div>

            <ContactEditForm contact={{ id: contact.id, name: contact.name, email: contact.email, company: contact.company, phone: contact.phone, notes: contact.notes }} />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-card)]">
              <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Pipeline</div>
              <div className="text-lg font-semibold text-fg tabular-nums mt-0.5">{formatCurrency(pipelineValue)}</div>
              <div className="text-[10px] text-fg-subtle">{openDeals.length} open job{openDeals.length === 1 ? "" : "s"}</div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-card)]">
              <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Revenue</div>
              <div className="text-lg font-semibold text-fg tabular-nums mt-0.5">{formatCurrency(totalRevenue)}</div>
              <div className="text-[10px] text-fg-subtle">{deals.filter(d => d.stage === "completed").length} completed</div>
            </div>
          </div>

          {/* Notes */}
          {contact.notes && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
              <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium mb-1.5">Notes</div>
              <p className="text-sm text-fg-muted whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          {/* Jobs list */}
          {deals.length > 0 && (
            <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-xs font-semibold text-fg">Jobs</div>
                <div className="text-[10px] text-fg-subtle">{deals.length} total</div>
              </div>
              <div className="divide-y divide-border">
                {deals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <StageBadge stage={deal.stage} />
                      <span className="text-sm text-fg truncate">{deal.title}</span>
                    </div>
                    <span className="text-xs font-semibold text-fg tabular-nums shrink-0">
                      {formatCurrency(deal.amount, deal.currency)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: activity timeline */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-fg">Activity</h2>
            <span className="text-xs text-fg-subtle">{timeline.length} event{timeline.length === 1 ? "" : "s"}</span>
          </div>

          {timeline.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-subtle">
              No activity yet — process your inbox to get started.
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
        : "bg-success";
  return (
    <span
      className={`absolute -left-[25px] top-3 h-2.5 w-2.5 rounded-full ${color} ring-3 ring-bg`}
    />
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "deal") {
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-fg-subtle font-medium">Job created</span>
            <StageBadge stage={entry.deal.stage} />
          </div>
          <span className="text-[11px] text-fg-subtle">{formatRelative(entry.at)}</span>
        </div>
        <Link href={`/deals/${entry.deal.id}`} className="text-sm font-medium text-fg hover:text-accent mt-1 block">
          {entry.deal.title}
        </Link>
        <div className="text-xs text-fg-subtle mt-0.5">{formatCurrency(entry.deal.amount, entry.deal.currency)}</div>
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
