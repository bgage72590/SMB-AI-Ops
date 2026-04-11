import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CategoryBadge,
  PriorityBadge,
  StageBadge,
} from "@/components/Badge";
import {
  getContact,
  getDeal,
  listEmailsForDeal,
  listFollowUpsForDeal,
} from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import type { Email, FollowUp } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

type TimelineEntry =
  | { kind: "email"; at: string; email: Email }
  | { kind: "followup"; at: string; followUp: FollowUp }
  | { kind: "stage"; at: string; label: string };

export default function DealDetailPage({ params }: Props) {
  const user = requireUser();
  const deal = getDeal(user.id, params.id);
  if (!deal) notFound();

  const contact = getContact(user.id, deal.contactId);
  const emails = listEmailsForDeal(user.id, deal.id);
  const followUps = listFollowUpsForDeal(user.id, deal.id);

  // Assemble a simple timeline from emails and follow-ups. We don't have a
  // dedicated activity log yet, but the two deal lifecycle events we can
  // reliably reconstruct — "deal created" and "last stage update" — are
  // worth pinning to the top.
  const timeline: TimelineEntry[] = [
    {
      kind: "stage",
      at: deal.createdAt,
      label: `Deal created in ${deal.stage}`,
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
      label: `Last activity · ${deal.stage}`,
    });
  }
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-8">
      <section>
        <Link
          href="/deals"
          className="text-xs text-ink-400 hover:text-ink-600"
        >
          ← All deals
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StageBadge stage={deal.stage} />
              <h1 className="text-2xl font-semibold text-ink-900 truncate">
                {deal.title}
              </h1>
            </div>
            {contact && (
              <div className="mt-2 text-ink-500">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="hover:text-accent"
                >
                  {contact.name}
                </Link>
                {contact.company && (
                  <span className="text-ink-400"> · {contact.company}</span>
                )}
                <span className="text-ink-300"> · </span>
                <a
                  href={`mailto:${contact.email}`}
                  className="hover:text-accent"
                >
                  {contact.email}
                </a>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-ink-900">
              {formatCurrency(deal.amount, deal.currency)}
            </div>
            <div className="text-xs text-ink-400 mt-1">
              Opened {formatRelative(deal.createdAt)}
            </div>
          </div>
        </div>
      </section>

      {deal.nextStep && (
        <section className="card p-4">
          <div className="text-xs uppercase tracking-wide text-ink-400 mb-1">
            Next step
          </div>
          <p className="text-sm text-ink-800">{deal.nextStep}</p>
        </section>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-400 mb-3">
          Activity
        </h2>
        {timeline.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">
            No activity yet.
          </div>
        ) : (
          <ol className="relative border-l border-ink-100 ml-2 space-y-4">
            {timeline.map((entry, idx) => (
              <li key={idx} className="ml-4">
                <span className="absolute -left-1.5 mt-2 h-3 w-3 rounded-full bg-accent ring-4 ring-white" />
                <TimelineRow entry={entry} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "stage") {
    return (
      <div className="card p-3">
        <div className="text-xs text-ink-400">
          {formatRelative(entry.at)}
        </div>
        <div className="text-sm text-ink-700 mt-1">{entry.label}</div>
      </div>
    );
  }
  if (entry.kind === "email") {
    const email = entry.email;
    return (
      <div className="card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-wide text-ink-400">
                Email
              </span>
              <span className="font-medium text-ink-900">{email.subject}</span>
              {email.category && <CategoryBadge category={email.category} />}
              {email.priority && <PriorityBadge priority={email.priority} />}
            </div>
            <div className="text-xs text-ink-500 mt-1">
              from {email.fromName || email.from}
            </div>
            {email.summary ? (
              <div className="text-sm text-ink-600 mt-2 italic">
                “{email.summary}”
              </div>
            ) : (
              <pre className="text-xs text-ink-500 mt-2 whitespace-pre-wrap font-sans line-clamp-3">
                {email.body}
              </pre>
            )}
          </div>
          <span className="text-xs text-ink-400 whitespace-nowrap">
            {formatRelative(email.receivedAt)}
          </span>
        </div>
      </div>
    );
  }
  const followUp = entry.followUp;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-ink-400">
              Follow-up
            </span>
            <span className="font-medium text-ink-900">{followUp.subject}</span>
            <span className="text-xs text-ink-400 uppercase tracking-wide">
              {followUp.status}
            </span>
          </div>
          <div className="text-xs text-ink-500 mt-1">{followUp.reason}</div>
        </div>
        <span className="text-xs text-ink-400 whitespace-nowrap">
          {formatRelative(followUp.createdAt)}
        </span>
      </div>
    </div>
  );
}
