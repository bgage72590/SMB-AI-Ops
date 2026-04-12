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

  const mobileStageFilter = searchParams?.stage as DealStage | undefined;
  const validFilter = mobileStageFilter && STAGES.some((c) => c.stage === mobileStageFilter);

  const activeStages = STAGES.filter(({ stage }) => byStage[stage].length > 0);
  const emptyStages = STAGES.filter(({ stage }) => byStage[stage].length === 0);

  return (
    <div className="space-y-6">
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
        <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-surface-2">
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
                className={`h-full ${colorMap[stage]} transition-all`}
                style={{ width: `${Math.max(pct, 3)}%` }}
                title={`${STAGES.find(s => s.stage === stage)?.label}: ${count}`}
              />
            );
          })}
        </div>
      )}

      {/* Stage filter chips (mobile) */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        <Link
          href="/deals"
          className={
            "shrink-0 inline-flex items-center h-7 px-3 rounded-full text-xs font-medium border transition-colors " +
            (!validFilter
              ? "bg-accent text-accent-fg border-accent"
              : "bg-surface text-fg-muted border-border hover:text-fg hover:bg-surface-2")
          }
        >
          All
        </Link>
        {STAGES.map(({ stage, label }) => {
          const count = byStage[stage].length;
          if (count === 0) return null;
          return (
            <Link
              key={stage}
              href={`/deals?stage=${stage}`}
              className={
                "shrink-0 inline-flex items-center h-7 px-3 rounded-full text-xs font-medium border transition-colors " +
                (mobileStageFilter === stage
                  ? "bg-accent text-accent-fg border-accent"
                  : "bg-surface text-fg-muted border-border hover:text-fg hover:bg-surface-2")
              }
            >
              {label} ({count})
            </Link>
          );
        })}
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-4">
        {deals.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface py-12 text-center">
            <div className="text-sm font-medium text-fg">No jobs yet</div>
            <p className="text-xs text-fg-subtle mt-1">
              Jobs appear here as the AI books appointments and tracks work.
            </p>
          </div>
        )}
        {(validFilter
          ? [{ stage: mobileStageFilter!, label: STAGES.find(c => c.stage === mobileStageFilter)!.label }]
          : STAGES
        )
          .filter(({ stage }) => byStage[stage].length > 0)
          .map(({ stage, label }) => (
            <div key={stage}>
              {!validFilter && (
                <div className="flex items-center gap-2 mb-2">
                  <StageBadge stage={stage} />
                  <span className="text-xs text-fg-subtle">
                    {byStage[stage].length} &middot; {formatCurrency(byStage[stage].reduce((s, d) => s + d.amount, 0))}
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
                            &rarr; {deal.nextStep}
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

      {/* Desktop kanban */}
      <div className="hidden md:block">
        {deals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center">
            <div className="text-sm font-medium text-fg">No jobs yet</div>
            <p className="text-xs text-fg-subtle mt-1 max-w-sm mx-auto">
              Jobs appear here as the AI books appointments and tracks work through the pipeline.
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            {/* Active columns — sized proportionally */}
            {activeStages.map(({ stage, label }) => {
              const column = byStage[stage];
              const total = column.reduce((s, d) => s + d.amount, 0);
              return (
                <div
                  key={stage}
                  className="flex-1 min-w-0 bg-surface border border-border rounded-xl p-3 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <StageBadge stage={stage} />
                      <span className="text-[11px] text-fg-subtle tabular-nums">{column.length}</span>
                    </div>
                    <span className="text-[11px] text-fg-subtle tabular-nums">{formatCurrency(total)}</span>
                  </div>
                  <ul className="space-y-2">
                    {column.map((deal) => {
                      const contact = getContact(user.id, deal.contactId);
                      return (
                        <li key={deal.id}>
                          <Link
                            href={`/deals/${deal.id}`}
                            className="block rounded-lg border border-border p-3 bg-surface-2/60 hover:bg-surface hover:border-accent/40 transition"
                          >
                            <div className="font-medium text-sm text-fg truncate">{deal.title}</div>
                            <div className="text-xs text-fg-muted truncate mt-0.5">{contact?.name || "\u2014"}</div>
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
                                &rarr; {deal.nextStep}
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

            {/* Empty columns — collapsed stubs */}
            {emptyStages.length > 0 && (
              <div className="flex gap-2 shrink-0">
                {emptyStages.map(({ stage, label }) => (
                  <div
                    key={stage}
                    className="w-20 bg-surface-2/50 border border-border rounded-xl p-2 flex flex-col items-center justify-start pt-3"
                  >
                    <StageBadge stage={stage} />
                    <span className="text-[10px] text-fg-subtle mt-1.5 text-center leading-tight">0</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
