import Link from "next/link";
import { StageBadge } from "@/components/Badge";
import { PageHeader, StatCard } from "@/components/ui";
import { getContact, listDeals } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import type { DealStage } from "@/lib/types";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const COLUMNS: Array<{ stage: DealStage; label: string }> = [
  { stage: "inquiry", label: "Inquiries" },
  { stage: "quoted", label: "Quoted" },
  { stage: "scheduled", label: "Scheduled" },
  { stage: "in_progress", label: "In progress" },
  { stage: "completed", label: "Completed" },
  { stage: "lost", label: "Lost" },
];

export default function JobsPage({
  searchParams,
}: {
  searchParams?: { stage?: string };
}) {
  const user = requireUser();
  const deals = listDeals(user.id);
  const byStage: Record<DealStage, typeof deals> = {
    inquiry: [],
    quoted: [],
    scheduled: [],
    in_progress: [],
    completed: [],
    lost: [],
  };
  for (const d of deals) byStage[d.stage].push(d);

  const openDeals = deals.filter(
    (d) => d.stage !== "completed" && d.stage !== "lost"
  );
  const openValue = openDeals.reduce((sum, d) => sum + d.amount, 0);
  const bookedValue = byStage.completed.reduce((s, d) => s + d.amount, 0);
  const bookedProfit = byStage.completed.reduce(
    (s, d) => s + (d.amount - d.costMaterials - d.costLabor),
    0
  );

  const mobileStageFilter = searchParams?.stage as DealStage | undefined;
  const validFilter = mobileStageFilter && COLUMNS.some((c) => c.stage === mobileStageFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipeline"
        title="Jobs"
        description={`${deals.length} total \u00b7 ${openDeals.length} still open`}
        actions={
          deals.length > 0 ? (
            <a
              href="/api/export?type=deals"
              download
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-border bg-surface text-fg-muted hover:bg-surface-2 transition-colors"
            >
              Export CSV
            </a>
          ) : undefined
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Open pipeline"
          value={formatCurrency(openValue)}
          hint={`${openDeals.length} job${openDeals.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Booked"
          value={formatCurrency(bookedValue)}
          hint={byStage.completed.length > 0 ? `${formatCurrency(bookedProfit)} profit \u00b7 ${byStage.completed.length} completed` : "0 completed"}
        />
        <StatCard
          label="Scheduled"
          value={byStage.scheduled.length}
          hint="on the books"
        />
        <StatCard
          label="Quoted"
          value={byStage.quoted.length}
          hint="awaiting reply"
        />
      </section>

      {/* Mobile stage filter */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        <Link
          href="/deals"
          className={
            "shrink-0 inline-flex items-center h-8 px-3 rounded-full text-xs font-medium border transition-colors " +
            (!validFilter
              ? "bg-accent text-accent-fg border-accent"
              : "bg-surface text-fg-muted border-border hover:text-fg hover:bg-surface-2")
          }
        >
          All
        </Link>
        {COLUMNS.map(({ stage, label }) => (
          <Link
            key={stage}
            href={`/deals?stage=${stage}`}
            className={
              "shrink-0 inline-flex items-center h-8 px-3 rounded-full text-xs font-medium border transition-colors " +
              (mobileStageFilter === stage
                ? "bg-accent text-accent-fg border-accent"
                : "bg-surface text-fg-muted border-border hover:text-fg hover:bg-surface-2")
            }
          >
            {label} ({byStage[stage].length})
          </Link>
        ))}
      </div>

      {/* Mobile card list (filtered by stage) */}
      <div className="md:hidden space-y-3">
        {(validFilter ? [{ stage: mobileStageFilter!, label: COLUMNS.find(c => c.stage === mobileStageFilter)!.label }] : COLUMNS)
          .filter(({ stage }) => byStage[stage].length > 0)
          .map(({ stage, label }) => (
            <div key={stage}>
              {!validFilter && (
                <div className="flex items-center gap-2 mb-2">
                  <StageBadge stage={stage} />
                  <span className="text-xs text-fg-subtle">
                    {byStage[stage].length} \u00b7 {formatCurrency(byStage[stage].reduce((s, d) => s + d.amount, 0))}
                  </span>
                </div>
              )}
              <ul className="space-y-2">
                {byStage[stage].map((deal) => {
                  const contact = getContact(user.id, deal.contactId);
                  return (
                    <li key={deal.id}>
                      <Link
                        href={`/deals/${deal.id}`}
                        className="block rounded-lg border border-border p-3 bg-surface hover:border-accent/40 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-fg truncate">{deal.title}</div>
                            <div className="text-xs text-fg-muted truncate mt-0.5">{contact?.name || "\u2014"}</div>
                          </div>
                          <span className="text-xs font-semibold text-fg tabular-nums shrink-0">
                            {formatCurrency(deal.amount, deal.currency)}
                          </span>
                        </div>
                        {deal.nextStep && (
                          <div className="text-[11px] text-fg-muted mt-2 line-clamp-2 border-t border-border pt-1.5">
                            \u2192 {deal.nextStep}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
      </div>

      {/* Desktop kanban board */}
      <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        {COLUMNS.map(({ stage, label }) => {
          const column = byStage[stage];
          const total = column.reduce((s, d) => s + d.amount, 0);
          return (
            <div
              key={stage}
              className="bg-surface border border-border rounded-xl p-3 min-h-[220px] shadow-card flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <StageBadge stage={stage} />
                  <span className="text-[11px] text-fg-subtle tabular-nums">
                    {column.length}
                  </span>
                </div>
                <span className="text-[11px] text-fg-subtle tabular-nums">
                  {formatCurrency(total)}
                </span>
              </div>
              <ul className="space-y-2 flex-1">
                {column.length === 0 && (
                  <li className="text-[11px] text-fg-subtle py-2 italic">
                    {label.toLowerCase()} is empty
                  </li>
                )}
                {column.map((deal) => {
                  const contact = getContact(user.id, deal.contactId);
                  return (
                    <li key={deal.id}>
                      <Link
                        href={`/deals/${deal.id}`}
                        className="block rounded-lg border border-border p-3 bg-surface-2/60 hover:bg-surface hover:border-accent/40 transition"
                      >
                        <div className="font-medium text-sm text-fg truncate">
                          {deal.title}
                        </div>
                        <div className="text-xs text-fg-muted truncate mt-0.5">
                          {contact?.name || "\u2014"}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-semibold text-fg tabular-nums">
                            {formatCurrency(deal.amount, deal.currency)}
                          </span>
                          <span className="text-[10px] text-fg-subtle">
                            {formatRelative(deal.lastActivityAt)}
                          </span>
                        </div>
                        {deal.nextStep && (
                          <div className="text-[11px] text-fg-muted mt-1.5 line-clamp-2 border-t border-border pt-1.5">
                            \u2192 {deal.nextStep}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
