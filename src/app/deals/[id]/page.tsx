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

export default function JobDetailPage({ params }: Props) {
  const user = requireUser();
  const deal = getDeal(user.id, params.id);
  if (!deal) notFound();

  const contact = getContact(user.id, deal.contactId);
  const emails = listEmailsForDeal(user.id, deal.id);
  const followUps = listFollowUpsForDeal(user.id, deal.id);

  // Assemble a simple timeline from emails and follow-ups. We don't have a
  // dedicated activity log yet, but the two job lifecycle events we can
  // reliably reconstruct — "job created" and "last stage update" — are
  // worth pinning to the top.
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
      label: `Last activity · ${deal.stage.replace("_", " ")}`,
    });
  }
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-8">
      <section>
        <Link
          href="/deals"
          className="text-xs text-fg-subtle hover:text-fg-muted"
        >
          ← All jobs
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StageBadge stage={deal.stage} />
              <h1 className="text-2xl font-semibold text-fg truncate">
                {deal.title}
              </h1>
            </div>
            {contact && (
              <div className="mt-2 text-fg-muted">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="hover:text-accent"
                >
                  {contact.name}
                </Link>
                {contact.company && (
                  <span className="text-fg-subtle"> · {contact.company}</span>
                )}
                <span className="text-fg-subtle"> · </span>
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
            <div className="text-2xl font-semibold text-fg">
              {formatCurrency(deal.amount, deal.currency)}
            </div>
            <div className="text-xs text-fg-subtle mt-1">
              Opened {formatRelative(deal.createdAt)}
            </div>
          </div>
        </div>
      </section>

      {deal.nextStep && (
        <section className="card p-4">
          <div className="text-xs uppercase tracking-wide text-fg-subtle mb-1">
            Next step
          </div>
          <p className="text-sm text-fg">{deal.nextStep}</p>
        </section>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-wide text-fg-subtle mb-3">
          Activity
        </h2>
        {timeline.length === 0 ? (
          <div className="card p-6 text-center text-sm text-fg-subtle">
            No activity yet.
          </div>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4">
            {timeline.map((entry, idx) => (
              <li key={idx} className="ml-4">
                <span className="absolute -left-1.5 mt-2 h-3 w-3 rounded-full bg-accent ring-4 ring-bg" />
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
        <div className="text-xs text-fg-subtle">
          {formatRelative(entry.at)}
        </div>
        <div className="text-sm text-fg-muted mt-1">{entry.label}</div>
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
              <span className="text-[11px] uppercase tracking-wide text-fg-subtle">
                Email
              </span>
              <span className="font-medium text-fg">{email.subject}</span>
              {email.category && <CategoryBadge category={email.category} />}
              {email.priority && <PriorityBadge priority={email.priority} />}
            </div>
            <div className="text-xs text-fg-muted mt-1">
              from {email.fromName || email.from}
            </div>
            {email.summary ? (
              <div className="text-sm text-fg-muted mt-2 italic">
                “{email.summary}”
              </div>
            ) : (
              <pre className="text-xs text-fg-muted mt-2 whitespace-pre-wrap font-sans line-clamp-3">
                {email.body}
              </pre>
            )}
          </div>
          <span className="text-xs text-fg-subtle whitespace-nowrap">
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
            <span className="text-[11px] uppercase tracking-wide text-fg-subtle">
              Follow-up
            </span>
            <span className="font-medium text-fg">{followUp.subject}</span>
            <span className="text-xs text-fg-subtle uppercase tracking-wide">
              {followUp.status}
            </span>
          </div>
          <div className="text-xs text-fg-muted mt-1">{followUp.reason}</div>
        </div>
        <span className="text-xs text-fg-subtle whitespace-nowrap">
          {formatRelative(followUp.createdAt)}
        </span>
      </div>
    </div>
  );
}
