import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { generatePipelineReport } from "@/lib/reports";
import { formatCurrency } from "@/lib/format";
import { StageBadge } from "@/components/Badge";
import { listDeals } from "@/lib/store";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports | SMB AI Ops",
  description: "Pipeline analytics and revenue forecasting.",
};

export const dynamic = "force-dynamic";

function getMonthlyRevenue(deals: ReturnType<typeof listDeals>) {
  const months: Record<string, number> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months[key] = 0;
  }
  for (const deal of deals) {
    if (deal.stage !== "completed") continue;
    const d = new Date(deal.updatedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in months) months[key] += deal.amount;
  }
  return Object.entries(months).map(([month, value]) => ({ month, value }));
}

function getMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels[parseInt(m, 10) - 1] + " " + y.slice(2);
}

export default function ReportsPage() {
  let user;
  try {
    user = requireUser();
  } catch {
    redirect("/login");
  }

  const report = generatePipelineReport(user.id);
  const wr = report.winRate;
  const deals = listDeals(user.id);
  const monthlyRevenue = getMonthlyRevenue(deals);
  const maxMonthly = Math.max(...monthlyRevenue.map((m) => m.value), 1);

  const openStages = report.stageBreakdown.filter(
    (b) => !["completed", "lost"].includes(b.stage) && b.count > 0
  );
  const maxStageValue = Math.max(...openStages.map((b) => b.totalValue), 1);

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

      {/* Secondary stats */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-fg-muted px-1">
        <span>Deals closed (90d): <strong className="text-fg">{wr.totalClosed}</strong></span>
        <span>At-risk: <strong className="text-fg">{report.atRisk.length}</strong> stale &gt;7d</span>
        <span>Open stages: <strong className="text-fg">{report.stageBreakdown.filter(b => b.count > 0).length}</strong></span>
      </div>

      {/* Two-column: Charts */}
      <section className="grid lg:grid-cols-2 gap-6">
        {/* Pipeline funnel */}
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-fg">Pipeline funnel</h2>
            <span className="text-xs text-fg-subtle">{openStages.reduce((s, b) => s + b.count, 0)} open jobs</span>
          </div>
          {openStages.length === 0 ? (
            <div className="text-sm text-fg-subtle py-6 text-center">No open jobs in pipeline</div>
          ) : (
            <div className="space-y-3">
              {openStages.map((b) => {
                const pct = (b.totalValue / maxStageValue) * 100;
                return (
                  <div key={b.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <StageBadge stage={b.stage} />
                        <span className="text-xs text-fg-muted">
                          {b.count} job{b.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-fg tabular-nums">
                          {formatCurrency(b.totalValue)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-6 rounded-md bg-surface-2 overflow-hidden relative">
                      <div
                        className="h-full rounded-md bg-accent/20 transition-all flex items-center"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      >
                        <div
                          className="h-full rounded-md bg-accent transition-all"
                          style={{ width: `${b.totalValue > 0 ? (b.weightedValue / b.totalValue) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-fg-subtle font-medium">
                        {formatCurrency(b.weightedValue)} weighted
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Win rate donut */}
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-fg">Win rate</h2>
            <span className="text-xs text-fg-subtle">Last 90 days</span>
          </div>
          <div className="flex items-center gap-8">
            {/* CSS donut */}
            <div className="relative w-32 h-32 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-surface-2"
                />
                {wr.totalClosed > 0 && (
                  <circle
                    cx="18" cy="18" r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={`${wr.winRate * 87.96} ${87.96 - wr.winRate * 87.96}`}
                    strokeLinecap="round"
                    className="text-success"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-fg tabular-nums">
                  {Math.round(wr.winRate * 100)}%
                </span>
                <span className="text-[10px] text-fg-subtle">win rate</span>
              </div>
            </div>
            <div className="space-y-3 flex-1 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-success shrink-0" />
                  <span className="text-sm text-fg">Won</span>
                </div>
                <div className="text-lg font-semibold text-fg tabular-nums ml-[18px]">{wr.won}</div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger shrink-0" />
                  <span className="text-sm text-fg">Lost</span>
                </div>
                <div className="text-lg font-semibold text-fg tabular-nums ml-[18px]">{wr.lost}</div>
              </div>
              <div className="border-t border-border pt-2">
                <div className="text-xs text-fg-subtle">Avg value: <strong className="text-fg">{formatCurrency(wr.avgDealValue)}</strong></div>
                <div className="text-xs text-fg-subtle mt-0.5">Avg close: <strong className="text-fg">{wr.avgDaysToClose}d</strong></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Revenue chart */}
      <section className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-fg">Revenue trend</h2>
          <span className="text-xs text-fg-subtle">Last 6 months (completed jobs)</span>
        </div>
        <div className="flex items-end gap-2 h-40">
          {monthlyRevenue.map((m) => {
            const pct = maxMonthly > 0 ? (m.value / maxMonthly) * 100 : 0;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-fg-subtle font-medium tabular-nums">
                  {m.value > 0 ? formatCurrency(m.value) : ""}
                </span>
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-md bg-accent transition-all hover:bg-accent/80"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="text-[10px] text-fg-subtle">{getMonthLabel(m.month)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pipeline by stage - full detail */}
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
