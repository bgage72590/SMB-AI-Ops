import { z } from "zod";
import {
  claimNextJob,
  completeJob,
  countPendingJobs,
  enqueueJob,
  failJob,
  getEmail,
  listEmails,
  type Job,
} from "./store";
import { processEmail } from "./pipeline";

// Background job queue. Every long-ish piece of work the product needs
// to do outside a request/response cycle lives here.
//
// Design goals:
//   - Zero new infrastructure: jobs live in the same SQLite file as
//     everything else. Fine for single-node deployments; when it's time
//     to scale horizontally, swap this file for a real queue (BullMQ,
//     Cloudflare Queues, SQS) — the call sites don't change.
//   - Idempotent handlers: every job type must be safe to run twice.
//     processEmail() is idempotent because it checks `email.processed`.
//   - Bounded per-invocation work: the runner processes at most N jobs
//     per call so platform function timeouts (~10-60s) don't kill the
//     worker mid-batch.
//   - Exponential backoff + max attempts in the store layer so a
//     transient Anthropic outage doesn't blow up the queue.

const DEFAULT_BATCH = 10;
const DEFAULT_BATCH_TIMEOUT_MS = 50_000; // leave headroom under 60s platform cap

export type JobType = "process_email";

const PROCESS_EMAIL_PAYLOAD = z.object({
  userId: z.string(),
  emailId: z.string(),
});

interface RunJobsResult {
  claimed: number;
  succeeded: number;
  failed: number;
  pendingAfter: number;
  timedOut: boolean;
}

export async function runJobs(options: {
  max?: number;
  timeoutMs?: number;
} = {}): Promise<RunJobsResult> {
  const max = options.max ?? DEFAULT_BATCH;
  const timeoutMs = options.timeoutMs ?? DEFAULT_BATCH_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let claimed = 0;
  let succeeded = 0;
  let failed = 0;
  let timedOut = false;

  while (claimed < max) {
    if (Date.now() >= deadline) {
      timedOut = true;
      break;
    }
    const job = claimNextJob();
    if (!job) break;
    claimed++;

    try {
      await dispatch(job);
      completeJob(job.id);
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[jobs] ${job.type} #${job.id} failed:`, message);
      failJob(job.id, message);
      failed++;
    }
  }

  return {
    claimed,
    succeeded,
    failed,
    pendingAfter: countPendingJobs(),
    timedOut,
  };
}

async function dispatch(job: Job): Promise<void> {
  switch (job.type as JobType) {
    case "process_email": {
      const parsed = PROCESS_EMAIL_PAYLOAD.parse(job.payload);
      const email = getEmail(parsed.userId, parsed.emailId);
      if (!email) {
        // Nothing to do — the email was deleted between enqueue and run.
        return;
      }
      if (email.processed) return; // idempotent
      await processEmail(parsed.userId, email);
      return;
    }
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

// ---------- Producers ----------

export function enqueueEmailProcessing(userId: string, emailId: string): Job {
  return enqueueJob({
    type: "process_email",
    userId,
    payload: { userId, emailId },
  });
}

/**
 * Enqueue every unprocessed email for a user. Returns the number of jobs
 * that were created. Safe to call repeatedly — the dispatcher no-ops on
 * already-processed emails.
 */
export function enqueueUnprocessedEmails(userId: string): number {
  const pending = listEmails(userId).filter((e) => !e.processed);
  for (const email of pending) {
    enqueueEmailProcessing(userId, email.id);
  }
  return pending.length;
}
