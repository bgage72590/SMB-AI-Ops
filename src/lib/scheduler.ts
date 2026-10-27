// In-process scheduler for the background jobs. The app runs as one
// long-lived Node server (see docs/deployment.md), so instead of an
// external cron poking /api/jobs/* we tick once a minute from inside the
// process. The /api/jobs/* routes stay as manual triggers.
//
// Daily and weekly jobs fire on the first tick at or after their UTC
// hour, so a server that was down at that moment catches up when it
// comes back. Each firing is claimed in the scheduler_runs table, so a
// restart inside the same day can't run a job twice.
//
// On by default in production, off in dev and tests. Override with
// SMB_AI_OPS_SCHEDULER=on|off.

import { runJobs, enqueueDecayNudges } from "./jobs";
import { runWeeklyDigest } from "./digest";
import { runNotifications } from "./notifications";
import { isBackupConfigured, runBackup } from "./backup";
import { claimSchedulerSlot } from "./store";

const TICK_MS = 60_000;

type Cadence =
  | { every: "minute" }
  | { every: "day"; hourUtc: number }
  | { every: "week"; dayUtc: number; hourUtc: number };

export interface ScheduledJob {
  name: string;
  cadence: Cadence;
  run: () => Promise<unknown> | unknown;
  enabled?: () => boolean;
}

export const SCHEDULE: ScheduledJob[] = [
  // Drain the background job queue (AI processing, nudges, etc.).
  { name: "job-queue", cadence: { every: "minute" }, run: () => runJobs() },
  // 03:00 UTC: back the SQLite file up to S3.
  {
    name: "backup",
    cadence: { every: "day", hourUtc: 3 },
    run: () => runBackup(),
    enabled: isBackupConfigured,
  },
  // 12:00 UTC (8am US Eastern): per-user alert email.
  { name: "notifications", cadence: { every: "day", hourUtc: 12 }, run: () => runNotifications() },
  // 14:00 UTC: enqueue nudges for deals with no recent activity.
  { name: "deal-decay", cadence: { every: "day", hourUtc: 14 }, run: () => enqueueDecayNudges() },
  // Monday 13:00 UTC: weekly AI digest.
  {
    name: "weekly-digest",
    cadence: { every: "week", dayUtc: 1, hourUtc: 13 },
    run: () => runWeeklyDigest(),
  },
];

/**
 * The slot a job is due for at `now`, or null if it isn't due. Minute
 * jobs return "" (always due, never recorded). Daily and weekly jobs
 * return the UTC date, which is the key claimed in scheduler_runs.
 */
export function dueSlot(cadence: Cadence, now: Date): string | null {
  if (cadence.every === "minute") return "";
  if (now.getUTCHours() < cadence.hourUtc) return null;
  if (cadence.every === "week" && now.getUTCDay() !== cadence.dayUtc) return null;
  return now.toISOString().slice(0, 10);
}

const running = new Set<string>();

/** Run every job that's due. Exported for tests; the timer calls it. */
export async function tick(now: Date = new Date(), jobs: ScheduledJob[] = SCHEDULE): Promise<void> {
  await Promise.all(
    jobs.map(async (job) => {
      if (running.has(job.name)) return; // previous run still going
      if (job.enabled && !job.enabled()) return;
      const slot = dueSlot(job.cadence, now);
      if (slot === null) return;
      if (slot !== "" && !claimSchedulerSlot(job.name, slot)) return;

      running.add(job.name);
      try {
        const result = await job.run();
        if (slot !== "") {
          console.log(`[scheduler] ${job.name} ${slot} done`, JSON.stringify(result));
        }
      } catch (err) {
        console.error(`[scheduler] ${job.name} failed:`, err);
      } finally {
        running.delete(job.name);
      }
    })
  );
}

export function isSchedulerEnabled(): boolean {
  const flag = process.env.SMB_AI_OPS_SCHEDULER;
  if (flag === "on") return true;
  if (flag === "off") return false;
  return process.env.NODE_ENV === "production";
}

// Survives dev hot reloads, which re-run instrumentation in the same process.
const globalForScheduler = globalThis as unknown as { __smbScheduler?: NodeJS.Timeout };

export function startScheduler(): void {
  if (globalForScheduler.__smbScheduler) return;
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref();
  globalForScheduler.__smbScheduler = timer;
  void tick();
  console.log(`[scheduler] started (${SCHEDULE.map((j) => j.name).join(", ")})`);
}
