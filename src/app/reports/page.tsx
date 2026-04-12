import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { generatePipelineReport } from "@/lib/reports";
import { formatCurrency } from "@/lib/format";
import { StageBadge } from "@/components/Badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports | SMB AI Ops",
  description: "Pipeline analytics and revenue forecasting.",
};

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const report = generatePipelineReport(user.id);
  const wr = report.winRate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-fg">Reports</h1>
        <p className="text-sm text-fg-muted mt-0.5">
          Pipeline analytics, win rate, and revenue forecast
        </p>
      </div>

      {/* Key metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">Total pipeline</div>
          <div className="mt-1.5 text-2xl font-semibold text-fg tabular-nums">{formatCurrency(report.totalPipeline)}</div>
          <div className="text-[11px] text-fg-subtle mt-1">
            {formatCurrency(report.weightedPipeline)} weighted
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">Monthly forecast</div>
          <div className="mt-1.5 text-2xl font-semibold text-fg tabular-nums">{formatCurrency(report.forecastMonthly)}</div>
          <div className="text-[11px] text-fg-subtle mt-1">based on velocity + pipeline</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">Win rate (90d)</div>
          <div className="mt-1.5 text-2xl font-semibold text-fg tabular-nums">{Math.round(wr.winRate * 100)}%</div>
          <div className="text-[11px] text-fg-subtle mt-1">{wr.won} won / {wr.lost} lost</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">Avg deal value</div>
          <div className="mt-1.5 text-2xl font-semibold text-fg tabular-nums">{formatCurrency(wr.avgDealValue)}</div>
          <div className="text-[11px] text-fg-subtle mt-1">{wr.avgDaysToClose}d avg close time</div>
        </div>
      </section>

      {/* Secondary stats — compact inline row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-fg-muted px-1">
        <span>Deals closed (90d): <strong className="text-fg">{wr.totalClosed}</strong></span>
        <span>At-risk: <strong className="text-fg">{report.atRisk.length}</strong> stale &gt;7d</span>
        <span>Open stages: <strong className="text-fg">{report.stageBreakdown.filter(b => b.count > 0).length}</strong></span>
      </div>

      {/* Pipeline by stage */}
      {report.stageBreakdown.some((b) => b.count > 0) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-fg">Pipeline by stage</h2>
            <span className="text-xs text-fg-subtle">Value with probability weighting</span>
          </div>
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] divide-y divide-border overflow-hidden">
            {report.stageBreakdown
              .filter((b) => b.count > 0)
              .map((b) => {
                const pct =
                  report.totalPipeline > 0
                    ? (b.totalValue / report.totalPipeline) * 100
                    : 0;
                return (
                  <div key={b.stage} className="px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <StageBadge stage={b.stage} />
                        <span className="text-fg-muted text-xs">
                          {b.count} job{b.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-fg tabular-nums">
                          {formatCurrency(b.totalValue)}
                        </span>
                        <span className="text-fg-subtle text-xs ml-2">
                          ({formatCurrency(b.weightedValue)} weighted)
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 w-full h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* At-risk jobs */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-fg">At-risk jobs</h2>
          <Link href="/deals" className="text-xs text-accent hover:underline">
            View pipeline
          </Link>
        </div>
        {report.atRisk.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-subtle">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success text-xs">&#10003;</span>
            No at-risk jobs right now. Nice work keeping things moving.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] divide-y divide-border overflow-hidden">
            {report.atRisk.map((r) => (
              <div
                key={r.deal.id}
                className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-surface-2/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StageBadge stage={r.deal.stage} />
                    <Link
                      href={`/deals/${r.deal.id}`}
                      className="text-sm font-medium text-fg truncate hover:text-accent transition-colors"
                    >
                      {r.deal.title}
                    </Link>
                  </div>
                  <div className="text-xs text-fg-subtle mt-0.5">{r.contactName}</div>
                  <div className="text-xs text-danger mt-0.5">{r.reason}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-fg tabular-nums">
                    {formatCurrency(r.deal.amount)}
                  </div>
                  <div className="text-[10px] text-fg-subtle">{r.daysSinceActivity}d stale</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
