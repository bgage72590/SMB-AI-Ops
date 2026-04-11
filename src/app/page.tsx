import Link from "next/link";
import { Stat } from "@/components/Stat";
import { ProcessButton } from "@/components/ProcessButton";
import {
  CategoryBadge,
  PriorityBadge,
  StageBadge,
} from "@/components/Badge";
import {
  getContact,
  listContacts,
  listDeals,
  listEmails,
  listFollowUps,
} from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { isAIConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const user = requireUser();
  const emails = listEmails(user.id);
  const deals = listDeals(user.id);
  const contacts = listContacts(user.id);
  const followUps = listFollowUps(user.id);

  const unprocessed = emails.filter((e) => !e.processed).length;
  const openDeals = deals.filter(
    (d) => d.stage !== "completed" && d.stage !== "lost"
  );
  const pipelineValue = openDeals.reduce((sum, d) => sum + d.amount, 0);
  const pendingFollowUps = followUps.filter((f) => f.status === "draft").length;

  const recentEmails = emails.slice(0, 5);
  const hotDeals = openDeals
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">
            Good morning, {firstName}
          </h1>
          <p className="text-ink-500 mt-1">
            Here&apos;s what&apos;s going on across your business today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProcessButton />
        </div>
      </section>

      {!isAIConfigured() && (
        <div className="card p-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            <strong>Heads up:</strong> <code>ANTHROPIC_API_KEY</code> is not set, so
            email triage and follow-up drafting are running in heuristic
            fallback mode. Copy <code>.env.example</code> to <code>.env</code>{" "}
            and add your key to enable real AI.
          </p>
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Unread emails"
          value={unprocessed}
          hint={`${emails.length} total in inbox`}
        />
        <Stat
          label="Open job value"
          value={formatCurrency(pipelineValue)}
          hint={`${openDeals.length} open jobs`}
        />
        <Stat
          label="Follow-ups pending"
          value={pendingFollowUps}
          hint="drafts waiting for review"
        />
        <Stat
          label="Clients"
          value={contacts.length}
          hint="in your book"
        />
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-900">Recent inbox</h2>
            <Link
              href="/inbox"
              className="text-sm text-accent hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-ink-100">
            {recentEmails.length === 0 && (
              <li className="py-4 text-sm text-ink-400">No emails yet.</li>
            )}
            {recentEmails.map((email) => (
              <li key={email.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-900 truncate">
                        {email.fromName || email.from}
                      </span>
                      {email.category && (
                        <CategoryBadge category={email.category} />
                      )}
                      {email.priority && (
                        <PriorityBadge priority={email.priority} />
                      )}
                    </div>
                    <div className="text-sm text-ink-700 truncate">
                      {email.subject}
                    </div>
                    {email.summary && (
                      <div className="text-xs text-ink-500 mt-1 line-clamp-2">
                        {email.summary}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-ink-400 whitespace-nowrap">
                    {formatRelative(email.receivedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">Top open jobs</h2>
            <Link href="/deals" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {hotDeals.length === 0 && (
              <li className="py-4 text-sm text-fg-subtle">No open jobs.</li>
            )}
            {hotDeals.map((deal) => {
              const contact = getContact(user.id, deal.contactId);
              return (
                <li key={deal.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-900 truncate">
                          {deal.title}
                        </span>
                        <StageBadge stage={deal.stage} />
                      </div>
                      <div className="text-xs text-ink-500 mt-1">
                        {contact?.name || "Unknown contact"}
                        {contact?.company ? ` · ${contact.company}` : ""}
                      </div>
                      {deal.nextStep && (
                        <div className="text-xs text-ink-600 mt-1">
                          Next: {deal.nextStep}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-ink-900">
                        {formatCurrency(deal.amount, deal.currency)}
                      </div>
                      <div className="text-xs text-ink-400">
                        {formatRelative(deal.lastActivityAt)}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
