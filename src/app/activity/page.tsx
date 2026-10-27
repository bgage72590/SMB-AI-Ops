import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  listEmails,
  listFollowUps,
  listDeals,
  listContacts,
  getContact,
} from "@/lib/store";
import { formatCurrency, formatRelative, formatAbsolute } from "@/lib/format";
import { CategoryBadge, PriorityBadge, StageBadge } from "@/components/Badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity | SMB AI Ops",
  description: "Global activity feed across all clients and jobs.",
};

export const dynamic = "force-dynamic";

type ActivityEntry =
  | { kind: "email"; at: string; data: { id: string; from: string; fromName?: string; subject: string; summary?: string; category?: string; priority?: string; contactName?: string } }
  | { kind: "followup"; at: string; data: { id: string; subject: string; status: string; reason: string; contactName?: string; channel?: string } }
  | { kind: "deal_created"; at: string; data: { id: string; title: string; amount: number; currency: string; stage: string; contactName?: string } }
  | { kind: "deal_completed"; at: string; data: { id: string; title: string; amount: number; currency: string; contactName?: string } }
  | { kind: "contact_added"; at: string; data: { id: string; name: string; email: string; company?: string } };

export default async function ActivityPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }

  const emails = listEmails(user.id);
  const followUps = listFollowUps(user.id);
  const deals = listDeals(user.id);
  const contacts = listContacts(user.id);
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const feed: ActivityEntry[] = [];

  for (const email of emails.filter((e) => e.processed)) {
    const contact = email.contactId ? contactMap.get(email.contactId) : undefined;
    feed.push({
      kind: "email",
      at: email.receivedAt,
      data: {
        id: email.id,
        from: email.from,
        fromName: email.fromName,
        subject: email.subject,
        summary: email.summary,
        category: email.category,
        priority: email.priority,
        contactName: contact?.name,
      },
    });
  }

  for (const f of followUps) {
    const contact = contactMap.get(f.contactId);
    feed.push({
      kind: "followup",
      at: f.createdAt,
      data: {
        id: f.id,
        subject: f.subject,
        status: f.status,
        reason: f.reason,
        contactName: contact?.name,
        channel: f.channel,
      },
    });
  }

  for (const deal of deals) {
    const contact = contactMap.get(deal.contactId);
    feed.push({
      kind: "deal_created",
      at: deal.createdAt,
      data: {
        id: deal.id,
        title: deal.title,
        amount: deal.amount,
        currency: deal.currency,
        stage: deal.stage,
        contactName: contact?.name,
      },
    });
    if (deal.stage === "completed") {
      feed.push({
        kind: "deal_completed",
        at: deal.updatedAt,
        data: {
          id: deal.id,
          title: deal.title,
          amount: deal.amount,
          currency: deal.currency,
          contactName: contact?.name,
        },
      });
    }
  }

  for (const contact of contacts) {
    feed.push({
      kind: "contact_added",
      at: contact.createdAt,
      data: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        company: contact.company,
      },
    });
  }

  feed.sort((a, b) => (a.at < b.at ? 1 : -1));

  const grouped = groupByDate(feed);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">Activity</h1>
        <p className="text-sm text-fg-muted mt-0.5">
          Everything happening across your business
        </p>
      </div>

      {feed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center">
          <div className="text-2xl mb-2">&#128203;</div>
          <div className="text-sm font-medium text-fg">No activity yet</div>
          <p className="text-xs text-fg-subtle mt-1 max-w-sm mx-auto">
            Process your inbox to start generating activity.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, entries }) => (
            <section key={label}>
              <div className="sticky top-0 z-10 bg-bg/80 backdrop-blur-sm py-1 mb-2">
                <h2 className="text-xs font-semibold text-fg-subtle uppercase tracking-wider">{label}</h2>
              </div>
              <ol className="relative border-l-2 border-border ml-2 space-y-2">
                {entries.map((entry, idx) => (
                  <li key={idx} className="ml-5 relative">
                    <ActivityDot kind={entry.kind} />
                    <ActivityCard entry={entry} />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDate(entries: ActivityEntry[]) {
  const groups: Array<{ label: string; entries: ActivityEntry[] }> = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  for (const entry of entries) {
    const ts = new Date(entry.at).getTime();
    let label: string;
    if (ts >= today) label = "Today";
    else if (ts >= yesterday) label = "Yesterday";
    else if (ts >= weekAgo) label = "This week";
    else {
      const d = new Date(entry.at);
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      label = `${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }
  return groups;
}

function ActivityDot({ kind }: { kind: string }) {
  const color =
    kind === "email" ? "bg-info" :
    kind === "followup" ? "bg-accent" :
    kind === "deal_created" ? "bg-warning" :
    kind === "deal_completed" ? "bg-success" :
    "bg-fg-subtle";
  return (
    <span className={`absolute -left-[25px] top-3 h-2.5 w-2.5 rounded-full ${color} ring-3 ring-bg`} />
  );
}

function ActivityCard({ entry }: { entry: ActivityEntry }) {
  if (entry.kind === "email") {
    const d = entry.data;
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-info font-medium">Email</span>
            {d.category && <CategoryBadge category={d.category as any} />}
            {d.priority && <PriorityBadge priority={d.priority as any} />}
          </div>
          <span className="text-[11px] text-fg-subtle">{formatRelative(entry.at)}</span>
        </div>
        <div className="text-sm font-medium text-fg mt-1">{d.subject}</div>
        <div className="text-xs text-fg-muted mt-0.5">
          from {d.fromName || d.from}
          {d.contactName && <span> &middot; {d.contactName}</span>}
        </div>
        {d.summary && d.summary !== d.subject && (
          <div className="text-xs text-fg-subtle mt-1 italic line-clamp-2">{d.summary}</div>
        )}
      </div>
    );
  }

  if (entry.kind === "followup") {
    const d = entry.data;
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-accent font-medium">Follow-up</span>
            <span className={`text-[10px] uppercase tracking-wide font-medium ${
              d.status === "sent" ? "text-success" :
              d.status === "dismissed" ? "text-fg-subtle" :
              "text-warning"
            }`}>
              {d.status}
            </span>
            {d.channel === "sms" && (
              <span className="text-[10px] font-medium bg-accent/10 text-accent px-1 py-0.5 rounded">SMS</span>
            )}
          </div>
          <span className="text-[11px] text-fg-subtle">{formatRelative(entry.at)}</span>
        </div>
        <div className="text-sm font-medium text-fg mt-1">{d.subject}</div>
        <div className="text-xs text-fg-muted mt-0.5">
          {d.contactName && <span>to {d.contactName} &middot; </span>}
          {d.reason}
        </div>
      </div>
    );
  }

  if (entry.kind === "deal_created") {
    const d = entry.data;
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-warning font-medium">Job created</span>
            <StageBadge stage={d.stage as any} />
          </div>
          <span className="text-[11px] text-fg-subtle">{formatRelative(entry.at)}</span>
        </div>
        <Link href={`/deals/${d.id}`} className="text-sm font-medium text-fg hover:text-accent mt-1 block">
          {d.title}
        </Link>
        <div className="text-xs text-fg-muted mt-0.5">
          {formatCurrency(d.amount, d.currency)}
          {d.contactName && <span> &middot; {d.contactName}</span>}
        </div>
      </div>
    );
  }

  if (entry.kind === "deal_completed") {
    const d = entry.data;
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-success font-medium">Job completed</span>
          <span className="text-[11px] text-fg-subtle">{formatRelative(entry.at)}</span>
        </div>
        <Link href={`/deals/${d.id}`} className="text-sm font-medium text-fg hover:text-accent mt-1 block">
          {d.title}
        </Link>
        <div className="text-xs text-fg-muted mt-0.5">
          <strong className="text-success">{formatCurrency(d.amount, d.currency)}</strong> earned
          {d.contactName && <span> &middot; {d.contactName}</span>}
        </div>
      </div>
    );
  }

  if (entry.kind === "contact_added") {
    const d = entry.data;
    return (
      <div className="rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-fg-subtle font-medium">Client added</span>
          <span className="text-[11px] text-fg-subtle">{formatRelative(entry.at)}</span>
        </div>
        <Link href={`/contacts/${d.id}`} className="text-sm font-medium text-fg hover:text-accent mt-1 block">
          {d.name}
        </Link>
        <div className="text-xs text-fg-muted mt-0.5">
          {d.email}
          {d.company && <span> &middot; {d.company}</span>}
        </div>
      </div>
    );
  }

  return null;
}
