import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CategoryBadge,
  PriorityBadge,
  StageBadge,
} from "@/components/Badge";
import {
  getContact,
  listDealsForContact,
  listEmailsForContact,
  listFollowUpsForContact,
} from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default function ContactDetailPage({ params }: Props) {
  const user = requireUser();
  const contact = getContact(user.id, params.id);
  if (!contact) notFound();

  const deals = listDealsForContact(user.id, contact.id);
  const emails = listEmailsForContact(user.id, contact.id);
  const followUps = listFollowUpsForContact(user.id, contact.id);

  const openDeals = deals.filter(
    (d) => d.stage !== "won" && d.stage !== "lost"
  );
  const closedDeals = deals.filter(
    (d) => d.stage === "won" || d.stage === "lost"
  );
  const pipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-8">
      <section>
        <Link
          href="/contacts"
          className="text-xs text-ink-400 hover:text-ink-600"
        >
          ← All contacts
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink-900">
              {contact.name}
            </h1>
            <div className="mt-1 text-ink-500">
              {contact.company ? (
                <span>
                  {contact.company}
                  <span className="text-ink-300"> · </span>
                </span>
              ) : null}
              <a
                href={`mailto:${contact.email}`}
                className="hover:text-accent"
              >
                {contact.email}
              </a>
              {contact.phone && (
                <span className="text-ink-400"> · {contact.phone}</span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-ink-400">
            <div>Added {formatRelative(contact.createdAt)}</div>
            <div>Last touch {formatRelative(contact.updatedAt)}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-ink-400">
            Open pipeline
          </div>
          <div className="mt-1 text-2xl font-semibold text-ink-900">
            {formatCurrency(pipelineValue)}
          </div>
          <div className="text-xs text-ink-500 mt-1">
            {openDeals.length} open ·{" "}
            {closedDeals.length} closed
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-ink-400">
            Emails
          </div>
          <div className="mt-1 text-2xl font-semibold text-ink-900">
            {emails.length}
          </div>
          <div className="text-xs text-ink-500 mt-1">
            in thread history
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-ink-400">
            Follow-ups
          </div>
          <div className="mt-1 text-2xl font-semibold text-ink-900">
            {followUps.filter((f) => f.status === "draft").length}
          </div>
          <div className="text-xs text-ink-500 mt-1">
            pending drafts
          </div>
        </div>
      </section>

      {contact.notes && (
        <section className="card p-4">
          <div className="text-xs uppercase tracking-wide text-ink-400 mb-2">
            Notes
          </div>
          <p className="text-sm text-ink-700 whitespace-pre-wrap">
            {contact.notes}
          </p>
        </section>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-400 mb-3">
          Deals
        </h2>
        {deals.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">
            No deals for this contact yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {deals.map((deal) => (
              <li key={deal.id}>
                <Link
                  href={`/deals/${deal.id}`}
                  className="card p-4 flex items-start justify-between gap-4 hover:border-accent/40 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StageBadge stage={deal.stage} />
                      <span className="font-medium text-ink-900 truncate">
                        {deal.title}
                      </span>
                    </div>
                    {deal.nextStep && (
                      <div className="text-xs text-ink-600 mt-1 line-clamp-1">
                        → {deal.nextStep}
                      </div>
                    )}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="font-semibold text-ink-900">
                      {formatCurrency(deal.amount, deal.currency)}
                    </div>
                    <div className="text-xs text-ink-400">
                      {formatRelative(deal.lastActivityAt)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-400 mb-3">
          Email history
        </h2>
        {emails.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-400">
            No emails associated with this contact.
          </div>
        ) : (
          <ul className="space-y-3">
            {emails.map((email) => (
              <li key={email.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink-900">
                        {email.subject}
                      </span>
                      {email.category && (
                        <CategoryBadge category={email.category} />
                      )}
                      {email.priority && (
                        <PriorityBadge priority={email.priority} />
                      )}
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {followUps.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wide text-ink-400 mb-3">
            Follow-ups
          </h2>
          <ul className="space-y-2">
            {followUps.map((followUp) => (
              <li key={followUp.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-900">
                        {followUp.subject}
                      </span>
                      <span className="text-xs text-ink-400 uppercase tracking-wide">
                        {followUp.status}
                      </span>
                    </div>
                    <div className="text-xs text-ink-500 mt-1">
                      {followUp.reason}
                    </div>
                  </div>
                  <span className="text-xs text-ink-400 whitespace-nowrap">
                    {formatRelative(followUp.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
