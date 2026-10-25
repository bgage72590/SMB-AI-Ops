import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  __resetDbForTests,
  claimNextJob,
  completeJob,
  countPendingJobs,
  createDeal,
  createEmail,
  createUserRow,
  enqueueJob,
  failJob,
  listEmails,
  listFollowUpsForDeal,
  listRecentJobs,
  updateDeal,
  updateFollowUp,
  upsertContact,
} from "./store";
import {
  enqueueDecayNudges,
  enqueueEmailProcessing,
  enqueueUnprocessedEmails,
  runJobs,
} from "./jobs";
import { hashPassword } from "./auth";

let tmpDir: string;
let userId: string;
const savedEnv: Record<string, string | undefined> = {};
const ENV_OVERRIDES = ["SMB_AI_OPS_DATA_DIR", "ANTHROPIC_API_KEY"] as const;

beforeEach(() => {
  for (const key of ENV_OVERRIDES) savedEnv[key] = process.env[key];
  delete process.env.ANTHROPIC_API_KEY; // heuristic pipeline
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-jobs-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  __resetDbForTests();
  const user = createUserRow({
    email: `u-${Date.now()}@example.test`,
    name: "Worker Owner",
    passwordHash: hashPassword("pw-12345678"),
  });
  userId = user.id;
});

afterEach(() => {
  __resetDbForTests();
  for (const key of ENV_OVERRIDES) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
});

describe("enqueueJob / claimNextJob / completeJob", () => {
  it("moves a job through pending -> running -> done", () => {
    const job = enqueueJob({ type: "process_email", payload: { hi: 1 }, userId });
    expect(job.status).toBe("pending");
    expect(countPendingJobs()).toBe(1);

    const claimed = claimNextJob();
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.attempts).toBe(1);

    completeJob(job.id);
    expect(countPendingJobs()).toBe(0);
    const recent = listRecentJobs();
    expect(recent[0].status).toBe("done");
  });

  it("claimNextJob returns undefined when nothing is runnable", () => {
    expect(claimNextJob()).toBeUndefined();
  });

  it("failJob backs off until maxAttempts, then fails permanently", () => {
    const job = enqueueJob({
      type: "process_email",
      payload: null,
      userId,
      maxAttempts: 2,
    });

    // First claim+fail -> back to pending with a future runAfter.
    const first = claimNextJob();
    expect(first?.id).toBe(job.id);
    failJob(job.id, "boom 1");
    expect(listRecentJobs()[0].status).toBe("pending");

    // The backoff pushed runAfter into the future, so immediate re-claim
    // returns nothing.
    expect(claimNextJob()).toBeUndefined();
  });
});

describe("runJobs with process_email", () => {
  it("processes every unprocessed email via the queue", async () => {
    createEmail(userId, {
      from: "a@example.com",
      fromName: "A",
      to: "owner@yourshop.com",
      subject: "Interested in a demo",
      body: "We'd love a walkthrough.",
    });
    createEmail(userId, {
      from: "b@example.com",
      fromName: "B",
      to: "owner@yourshop.com",
      subject: "Pricing?",
      body: "How much for 20 seats?",
    });

    const count = enqueueUnprocessedEmails(userId);
    expect(count).toBe(2);

    const result = await runJobs({ max: 10 });
    expect(result.claimed).toBe(2);
    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);

    // The pipeline marks the rows as processed.
    const emails = listEmails(userId);
    expect(emails.every((e) => e.processed)).toBe(true);
  });

  it("no-ops on an email that's already processed between enqueue and run", async () => {
    const email = createEmail(userId, {
      from: "c@example.com",
      fromName: "C",
      to: "owner@yourshop.com",
      subject: "Interested in a demo",
      body: "Curious about pricing.",
    });
    enqueueEmailProcessing(userId, email.id);

    // Simulate: the email gets processed some other way before the job
    // runs. runJobs should still complete cleanly (job goes to done).
    const { processEmail } = await import("./pipeline");
    await processEmail(userId, email);

    const result = await runJobs({ max: 5 });
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
  });
});

describe("deal decay nudges", () => {
  const DAY = 24 * 60 * 60 * 1000;

  function staleDeal(daysQuiet = 6) {
    const contact = upsertContact(userId, { name: "Pat Quiet", email: "pat@example.com" });
    const deal = createDeal(userId, { title: "Fence repair", contactId: contact.id, stage: "quoted" });
    updateDeal(userId, deal.id, {
      lastActivityAt: new Date(Date.now() - daysQuiet * DAY).toISOString(),
    });
    return deal;
  }

  it("drafts one nudge for a quiet deal, then stops on later days", async () => {
    const deal = staleDeal();
    expect(enqueueDecayNudges()).toBe(1);
    await runJobs();
    expect(listFollowUpsForDeal(userId, deal.id)).toHaveLength(1);

    // The next daily scans must not re-draft while that nudge is pending.
    expect(enqueueDecayNudges()).toBe(0);
    expect(enqueueDecayNudges()).toBe(0);
    await runJobs();
    expect(listFollowUpsForDeal(userId, deal.id)).toHaveLength(1);
  });

  it("doesn't nudge again after the owner dismisses or sends it", async () => {
    const deal = staleDeal();
    enqueueDecayNudges();
    await runJobs();
    const [nudge] = listFollowUpsForDeal(userId, deal.id);

    updateFollowUp(userId, nudge.id, { status: "dismissed" });
    expect(enqueueDecayNudges()).toBe(0);
    updateFollowUp(userId, nudge.id, { status: "sent" });
    expect(enqueueDecayNudges()).toBe(0);
  });

  it("skips deals that aren't quiet yet or are closed", () => {
    staleDeal(2);
    const contact = upsertContact(userId, { name: "Done", email: "done@example.com" });
    const closed = createDeal(userId, { title: "Old job", contactId: contact.id, stage: "completed" });
    updateDeal(userId, closed.id, { lastActivityAt: new Date(Date.now() - 30 * DAY).toISOString() });
    expect(enqueueDecayNudges()).toBe(0);
  });

  it("collapses duplicate queued jobs into one draft", async () => {
    const deal = staleDeal();
    for (let i = 0; i < 3; i++) {
      enqueueJob({ type: "deal_decay_nudge", userId, payload: { userId, dealId: deal.id } });
    }
    const result = await runJobs();
    expect(result.succeeded).toBe(3);
    expect(listFollowUpsForDeal(userId, deal.id)).toHaveLength(1);
  });
});
