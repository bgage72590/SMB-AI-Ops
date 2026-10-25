import Link from "next/link";
import { StageBadge } from "@/components/Badge";
import { getContact, listDeals } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import type { DealStage } from "@/lib/types";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jobs | SMB AI Ops",
  description: "Track your jobs through the pipeline.",
};

export const dynamic = "force-dynamic";

const STAGES: Array<{ stage: DealStage; label: string }> = [
  { stage: "inquiry", label: "Inquiries" },
  { stage: "quoted", label: "Quoted" },
  { stage: "scheduled", label: "Scheduled" },
  { stage: "in_progress", label: "In progress" },
  { stage: "completed", label: "Completed" },
  { stage: "lost", label: "Lost" },
];

const STAGE_ORDER: Record<DealStage, number> = {
  inquiry: 0,
  quoted: 1,
  scheduled: 2,
  in_progress: 3,
  completed: 4,
  lost: 5,
};

export default async function JobsPage(props: {
  searchParams?: Promise<{ stage?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
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

  const stageFilter = searchParams?.stage as DealStage | undefined;
  const validFilter = stageFilter && STAGES.some((c) => c.stage === stageFilter);

  const filteredDeals = validFilter
    ? byStage[stageFilter!]
    : [...deals].sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || b.amount - a.amount);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Jobs</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            {openDeals.length} open &middot; {formatCurrency(openValue)} in pipeline
          </p>
        </div>
        {deals.length > 0 && (
          <a
            href="/api/export?type=deals"
            download
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-border bg-surface text-fg-muted hover:bg-surface-2 transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </a>
        )}
      </div>

      {/* Pipeline summary bar */}
      {deals.length > 0 && (
        <div className="flex items-center gap-0.5 h-2 rounded-full overflow-hidden bg-surface-2">
          {STAGES.map(({ stage }) => {
            const count = byStage[stage].length;
            if (count === 0) return null;
            const pct = (count / deals.length) * 100;
            const colorMap: Record<DealStage, string> = {
              inquiry: "bg-fg-subtle/30",
              quoted: "bg-info",
              scheduled: "bg-accent",
              in_progress: "bg-warning",
              completed: "bg-success",
              lost: "bg-danger",
            };
            return (
              <div
                key={stage}
                className={`h-full rounded-full ${colorMap[stage]} transition-all`}
                style={{ width: `${Math.max(pct, 4)}%` }}
                title={`${STAGES.find(s => s.stage === stage)?.label}: ${count}`}
              />
            );
          })}
        </div>
      )}

      {/* Stage filter chips */}
      {deals.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <Link
            href="/deals"
            className={
              "shrink-0 inline-flex items-center h-7 px-3 rounded-full text-xs font-medium border transition-colors " +
              (!validFilter
                ? "bg-accent text-accent-fg border-accent"
                : "bg-surface text-fg-muted border-border hover:text-fg hover:bg-surface-2")
            }
          >
            All ({deals.length})
          </Link>
          {STAGES.map(({ stage, label }) => {
            const count = byStage[stage].length;
            if (count === 0) return null;
            return (
              <Link
                key={stage}
                href={`/deals?stage=${stage}`}
                className={
                  "shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium border transition-colors " +
                  (stageFilter === stage
                    ? "bg-accent text-accent-fg border-accent"
                    : "bg-surface text-fg-muted border-border hover:text-fg hover:bg-surface-2")
                }
              >
                {label} ({count})
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {deals.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface py-14 text-center">
          <div className="text-sm font-medium text-fg">No jobs yet</div>
          <p className="text-xs text-fg-subtle mt-1 max-w-xs mx-auto">
            Jobs appear here as the AI books appointments and tracks work through the pipeline.
          </p>
        </div>
      )}

      {/* Desktop table */}
      {filteredDeals.length > 0 && (
        <div className="hidden md:block rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
                <th className="text-left px-4 py-2.5">Job</th>
                <th className="text-left px-4 py-2.5">Stage</th>
                <th className="text-left px-4 py-2.5">Client</th>
                <th className="text-right px-4 py-2.5">Amount</th>
                <th className="text-left px-4 py-2.5">Next step</th>
                <th className="text-right px-4 py-2.5">Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDeals.map((deal) => {
                const contact = getContact(user.id, deal.contactId);
                return (
                  <tr key={deal.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="font-medium text-fg hover:text-accent transition-colors"
                      >
                        {deal.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={deal.stage} />
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {contact?.name || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-fg tabular-nums">
                      {formatCurrency(deal.amount, deal.currency)}
                    </td>
                    <td className="px-4 py-3 text-fg-muted text-xs max-w-[200px] truncate">
                      {deal.nextStep || "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-fg-subtle whitespace-nowrap">
                      {formatRelative(deal.lastActivityAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {filteredDeals.length === 0 && deals.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-subtle">
            No jobs in this stage.
          </div>
        )}
        {filteredDeals.map((deal) => {
          const contact = getContact(user.id, deal.contactId);
          return (
            <Link
              key={deal.id}
              href={`/deals/${deal.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 hover:border-accent/40 transition"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StageBadge stage={deal.stage} />
                  <span className="font-medium text-sm text-fg truncate">{deal.title}</span>
                </div>
                <div className="text-xs text-fg-muted mt-0.5 flex items-center gap-2">
                  <span>{contact?.name || "\u2014"}</span>
                  {deal.nextStep && (
                    <>
                      <span className="text-border">&middot;</span>
                      <span className="truncate">&rarr; {deal.nextStep}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-fg tabular-nums">
                  {formatCurrency(deal.amount, deal.currency)}
                </div>
                <div className="text-[10px] text-fg-subtle">
                  {formatRelative(deal.lastActivityAt)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
