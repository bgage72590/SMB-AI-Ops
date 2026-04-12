import { listDeals, listContacts } from "./store";
import type { Deal, DealStage } from "./types";
import { OPEN_DEAL_STAGES, TERMINAL_DEAL_STAGES } from "./types";

// Pipeline reporting & forecasting. Every function takes a userId so
// results are always scoped. The nightly cron materializes a snapshot
// into the pipeline_snapshots table; the dashboard reads it back.

// ---------- Stage weights for weighted pipeline ----------

const STAGE_WEIGHT: Record<DealStage, number> = {
  inquiry: 0.1,
  quoted: 0.3,
  scheduled: 0.6,
  in_progress: 0.8,
  completed: 1.0,
  lost: 0.0,
};

// ---------- Types ----------

export interface StageBreakdown {
  stage: DealStage;
  count: number;
  totalValue: number;
  weightedValue: number;
}

export interface WinRateStats {
  totalClosed: number;
  won: number;
  lost: number;
  winRate: number;
  avgDealValue: number;
  avgDaysToClose: number;
}

export interface AtRiskDeal {
  deal: Deal;
  contactName: string;
  daysSinceActivity: number;
  reason: string;
}

export interface PipelineReport {
  generatedAt: string;
  stageBreakdown: StageBreakdown[];
  totalPipeline: number;
  weightedPipeline: number;
  winRate: WinRateStats;
  atRisk: AtRiskDeal[];
  forecastMonthly: number;
}

// ---------- Core analytics ----------

export function computeStageBreakdown(userId: string): StageBreakdown[] {
  const deals = listDeals(userId);
  const stages: DealStage[] = [
    ...OPEN_DEAL_STAGES,
    ...TERMINAL_DEAL_STAGES,
  ] as DealStage[];

  return stages.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage);
    const totalValue = inStage.reduce((s, d) => s + d.amount, 0);
    return {
      stage,
      count: inStage.length,
      totalValue,
      weightedValue: totalValue * STAGE_WEIGHT[stage],
    };
  });
}

export function computeWinRate(userId: string, daysBack = 90): WinRateStats {
  const deals = listDeals(userId);
  const cutoff = new Date(
    Date.now() - daysBack * 24 * 60 * 60 * 1000
  ).toISOString();

  const closed = deals.filter(
    (d) =>
      (d.stage === "completed" || d.stage === "lost") &&
      d.updatedAt >= cutoff
  );

  const won = closed.filter((d) => d.stage === "completed");
  const lost = closed.filter((d) => d.stage === "lost");
  const totalClosed = closed.length;

  const avgDealValue =
    won.length > 0 ? won.reduce((s, d) => s + d.amount, 0) / won.length : 0;

  const avgDaysToClose =
    won.length > 0
      ? won.reduce((s, d) => {
          const created = new Date(d.createdAt).getTime();
          const updated = new Date(d.updatedAt).getTime();
          return s + (updated - created) / (1000 * 60 * 60 * 24);
        }, 0) / won.length
      : 0;

  return {
    totalClosed,
    won: won.length,
    lost: lost.length,
    winRate: totalClosed > 0 ? won.length / totalClosed : 0,
    avgDealValue: Math.round(avgDealValue * 100) / 100,
    avgDaysToClose: Math.round(avgDaysToClose * 10) / 10,
  };
}

export function findAtRiskDeals(
  userId: string,
  staleDays = 7
): AtRiskDeal[] {
  const deals = listDeals(userId);
  const contacts = listContacts(userId);
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  const nowMs = Date.now();

  const results: AtRiskDeal[] = [];

  for (const deal of deals) {
    if (deal.stage === "completed" || deal.stage === "lost") continue;

    const lastMs = new Date(deal.lastActivityAt).getTime();
    const daysSince = (nowMs - lastMs) / (1000 * 60 * 60 * 24);

    if (daysSince >= staleDays) {
      const contact = contactMap.get(deal.contactId);
      results.push({
        deal,
        contactName: contact?.name ?? "Unknown",
        daysSinceActivity: Math.round(daysSince),
        reason:
          daysSince >= staleDays * 2
            ? "Going cold — no activity in over 2 weeks"
            : "Stale — no activity in over a week",
      });
    }
  }

  return results.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
}

export function computeForecast(userId: string): number {
  const breakdown = computeStageBreakdown(userId);
  const winRate = computeWinRate(userId);

  const weightedTotal = breakdown.reduce(
    (s, b) => s + b.weightedValue,
    0
  );

  const avgDays = winRate.avgDaysToClose || 30;
  const monthlyVelocity = 30 / avgDays;

  return Math.round(weightedTotal * monthlyVelocity * 100) / 100;
}

export function generatePipelineReport(userId: string): PipelineReport {
  const stageBreakdown = computeStageBreakdown(userId);
  const winRate = computeWinRate(userId);
  const atRisk = findAtRiskDeals(userId);
  const forecastMonthly = computeForecast(userId);

  const totalPipeline = stageBreakdown
    .filter((b) => OPEN_DEAL_STAGES.includes(b.stage as never))
    .reduce((s, b) => s + b.totalValue, 0);

  const weightedPipeline = stageBreakdown
    .filter((b) => OPEN_DEAL_STAGES.includes(b.stage as never))
    .reduce((s, b) => s + b.weightedValue, 0);

  return {
    generatedAt: new Date().toISOString(),
    stageBreakdown,
    totalPipeline,
    weightedPipeline,
    winRate,
    atRisk,
    forecastMonthly,
  };
}
