import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CategoryBadge,
  PriorityBadge,
  StageBadge,
} from "@/components/Badge";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
} from "@/components/ui";
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
  const pendingDrafts = followUps.filter((f) => f.status === "draft").length;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/contacts"
          className="text-xs text-fg-subtle hover:text-fg-muted"
        >
          ← All clients
        </Link>
        <PageHeader
          className="mt-2"
          eyebrow="Client"
          title={contact.name}
          description={
            <span>
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
            </span>
          }
          actions={
            <div className="text-right text-xs text-fg-subtle">
              <div>Added {formatRelative(contact.createdAt)}</div>
              <div>Last touch {formatRelative(contact.updatedAt)}</div>
            </div>
          }
        />
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open job value"
          value={formatCurrency(pipelineValue)}
          hint={`${openDeals.length} open · ${closedDeals.length} closed`}
        />
        <StatCard
          label="Emails"
          value={emails.length}
          hint="in thread history"
        />
        <StatCard
          label="Follow-ups"
          value={pendingDrafts}
          hint="pending drafts"
        />
      </section>

      {contact.notes && (
        <Card>
          <CardBody>
            <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold mb-2">
              Notes
            </div>
            <p className="text-sm text-fg-muted whitespace-pre-wrap">
              {contact.notes}
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Jobs"
          subtitle={`${deals.length} total · ${openDeals.length} open`}
        />
        <CardBody>
          {deals.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No jobs yet"
              description="Jobs appear here as emails turn into quotes and bookings."
            />
          ) : (
            <ul className="divide-y divide-border">
              {deals.map((deal) => (
                <li key={deal.id}>
                  <Link
                    href={`/deals/${deal.id}`}
                    className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4 hover:text-accent transition"
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
                      <div className="font-semibold text-fg tabular-nums">
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Email history"
          subtitle={`${emails.length} message${emails.length === 1 ? "" : "s"}`}
        />
        <CardBody>
          {emails.length === 0 ? (
            <EmptyState
              icon="✉️"
              title="No emails yet"
              description="Inbound mail from this client will show up here once triaged."
            />
          ) : (
            <ul className="space-y-3">
              {emails.map((email) => (
                <li
                  key={email.id}
                  className="rounded-lg border border-border bg-surface-2/60 p-4"
                >
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
        </CardBody>
      </Card>

      {followUps.length > 0 && (
        <Card>
          <CardHeader
            title="Follow-ups"
            subtitle={`${followUps.length} total · ${pendingDrafts} pending`}
          />
          <CardBody>
            <ul className="divide-y divide-border">
              {followUps.map((followUp) => (
                <li
                  key={followUp.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
                >
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
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
