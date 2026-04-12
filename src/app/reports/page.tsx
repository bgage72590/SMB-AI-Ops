import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { generatePipelineReport } from "@/lib/reports";
import { formatCurrency } from "@/lib/format";
import { StageBadge } from "@/components/Badge";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  StatCard,
} from "@/components/ui";
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
      <PageHeader
        eyebrow="Analytics"
        title="Pipeline Reports"
        description="Weighted pipeline, win rate, and deals at risk"
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total pipeline"
          value={formatCurrency(report.totalPipeline)}
          hint="open jobs value"
        />
        <StatCard
          label="Weighted pipeline"
          value={formatCurrency(report.weightedPipeline)}
          hint="probability-adjusted"
        />
        <StatCard
          label="Win rate (90d)"
          value={`${Math.round(wr.winRate * 100)}%`}
          hint={`${wr.won} won / ${wr.lost} lost`}
        />
        <StatCard
          label="Monthly forecast"
          value={formatCurrency(report.forecastMonthly)}
          hint="based on velocity + pipeline"
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Avg deal value"
          value={formatCurrency(wr.avgDealValue)}
          hint="completed deals"
        />
        <StatCard
          label="Avg days to close"
          value={wr.avgDaysToClose.toString()}
          hint="from inquiry to completed"
        />
        <StatCard
          label="Deals closed (90d)"
          value={wr.totalClosed.toString()}
          hint={`${wr.won} won, ${wr.lost} lost`}
        />
        <StatCard
          label="At-risk jobs"
          value={report.atRisk.length.toString()}
          hint="stale over 7 days"
        />
      </section>

      <Card>
        <CardHeader
          title="Pipeline by stage"
          subtitle="Value breakdown with probability weighting"
        />
        <CardBody>
          <div className="space-y-3">
            {report.stageBreakdown
              .filter((b) => b.count > 0)
              .map((b) => {
                const pct =
                  report.totalPipeline > 0
                    ? (b.totalValue / report.totalPipeline) * 100
                    : 0;
                return (
                  <div key={b.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <StageBadge stage={b.stage} />
                        <span className="text-fg-muted">
                          {b.count} job{b.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-fg">
                          {formatCurrency(b.totalValue)}
                        </span>
                        <span className="text-fg-subtle text-xs ml-2">
                          ({formatCurrency(b.weightedValue)} weighted)
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="At-risk jobs"
          subtitle="Open jobs with no recent activity"
          action={
            <Link href="/deals" className="text-xs text-accent hover:underline">
              View pipeline
            </Link>
          }
        />
        <CardBody>
          {report.atRisk.length === 0 ? (
            <p className="text-sm text-fg-muted py-4 text-center">
              No at-risk jobs right now. Nice work keeping things moving.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {report.atRisk.map((r) => (
                <li
                  key={r.deal.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StageBadge stage={r.deal.stage} />
                      <Link
                        href={`/deals/${r.deal.id}`}
                        className="font-medium text-fg truncate hover:text-accent"
                      >
                        {r.deal.title}
                      </Link>
                    </div>
                    <div className="text-xs text-fg-subtle mt-1">
                      {r.contactName}
                    </div>
                    <div className="text-xs text-danger mt-0.5">{r.reason}</div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="font-semibold text-fg tabular-nums">
                      {formatCurrency(r.deal.amount)}
                    </div>
                    <div className="text-[10px] text-fg-subtle">
                      {r.daysSinceActivity}d stale
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
