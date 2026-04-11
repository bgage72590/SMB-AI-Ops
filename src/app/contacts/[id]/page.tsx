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
  const closedDeals = deals.filter(
    (d) => d.stage === "completed" || d.stage === "lost"
  );
  const pipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-8">
      <section>
        <Link
          href="/contacts"
          className="text-xs text-fg-subtle hover:text-fg-muted"
        >
          ← All clients
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-fg">
              {contact.name}
            </h1>
            <div className="mt-1 text-fg-muted">
              {contact.company ? (
                <span>
                  {contact.company}
                  <span className="text-fg-subtle"> · </span>
                </span>
              ) : null}
              <a
                href={`mailto:${contact.email}`}
                className="hover:text-accent"
              >
                {contact.email}
              </a>
              {contact.phone && (
                <span className="text-fg-subtle"> · {contact.phone}</span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-fg-subtle">
            <div>Added {formatRelative(contact.createdAt)}</div>
            <div>Last touch {formatRelative(contact.updatedAt)}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-fg-subtle font-semibold">
            Open jobs
          </div>
          <div className="mt-1 text-2xl font-semibold text-fg tabular-nums">
            {formatCurrency(pipelineValue)}
          </div>
          <div className="text-xs text-fg-subtle mt-1">
            {openDeals.length} open · {closedDeals.length} closed
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-fg-subtle font-semibold">
            Emails
          </div>
          <div className="mt-1 text-2xl font-semibold text-fg">
            {emails.length}
          </div>
          <div className="text-xs text-fg-subtle mt-1">in thread history</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wider text-fg-subtle font-semibold">
            Follow-ups
          </div>
          <div className="mt-1 text-2xl font-semibold text-fg">
            {followUps.filter((f) => f.status === "draft").length}
          </div>
          <div className="text-xs text-fg-subtle mt-1">pending drafts</div>
        </div>
      </section>

      {contact.notes && (
        <section className="card p-4">
          <div className="text-xs uppercase tracking-wide text-fg-subtle mb-2">
            Notes
          </div>
          <p className="text-sm text-fg-muted whitespace-pre-wrap">
            {contact.notes}
          </p>
        </section>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-wider text-fg-subtle font-semibold mb-3">
          Jobs
        </h2>
        {deals.length === 0 ? (
          <div className="card p-6 text-center text-sm text-fg-subtle">
            No jobs for this client yet.
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
                      <span className="font-medium text-fg truncate">
                        {deal.title}
                      </span>
                    </div>
                    {deal.nextStep && (
                      <div className="text-xs text-fg-muted mt-1 line-clamp-1">
                        → {deal.nextStep}
                      </div>
                    )}
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="font-semibold text-fg">
                      {formatCurrency(deal.amount, deal.currency)}
                    </div>
                    <div className="text-xs text-fg-subtle">
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
        <h2 className="text-sm uppercase tracking-wider text-fg-subtle font-semibold mb-3">
          Email history
        </h2>
        {emails.length === 0 ? (
          <div className="card p-6 text-center text-sm text-fg-subtle">
            No emails associated with this client.
          </div>
        ) : (
          <ul className="space-y-3">
            {emails.map((email) => (
              <li key={email.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-fg">
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {followUps.length > 0 && (
        <section>
          <h2 className="text-sm uppercase tracking-wider text-fg-subtle font-semibold mb-3">
            Follow-ups
          </h2>
          <ul className="space-y-2">
            {followUps.map((followUp) => (
              <li key={followUp.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-fg">
                        {followUp.subject}
                      </span>
                      <span className="text-xs text-fg-subtle uppercase tracking-wide">
                        {followUp.status}
                      </span>
                    </div>
                    <div className="text-xs text-fg-muted mt-1">
                      {followUp.reason}
                    </div>
                  </div>
                  <span className="text-xs text-fg-subtle whitespace-nowrap">
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
