import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  __resetDbForTests,
  createEmail,
  createUserRow,
  upsertContact,
  createDeal,
} from "./store";
import { hashPassword } from "./auth";
import { buildUserDigest, computeStats, renderDigestBody } from "./digest";

let tmpDir: string;
const savedEnv: Record<string, string | undefined> = {};
const ENV_OVERRIDES = [
  "SMB_AI_OPS_DATA_DIR",
  "ANTHROPIC_API_KEY",
  "APP_BASE_URL",
] as const;

beforeEach(() => {
  for (const key of ENV_OVERRIDES) savedEnv[key] = process.env[key];
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-digest-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  process.env.APP_BASE_URL = "https://test.example";
  // Force heuristic path in writeHeadline so we don't hit the network.
  delete process.env.ANTHROPIC_API_KEY;
  __resetDbForTests();
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

function makeUser() {
  return createUserRow({
    email: `u-${Date.now()}@example.test`,
    name: "Shop Owner",
    passwordHash: hashPassword("pw-12345678"),
  });
}

describe("computeStats", () => {
  it("counts new emails, new contacts, pending follow-ups, open pipeline", () => {
    const user = makeUser();

    // A fresh email in the last week.
    const emailRow = createEmail(user.id, {
      from: "lead@example.com",
      fromName: "Lead Person",
      to: "owner@yourshop.com",
      subject: "Pricing question",
      body: "Curious about pricing.",
    });
    expect(emailRow.id).toBeTruthy();

    // A contact created just now.
    const contact = upsertContact(user.id, {
      name: "Lead Person",
      email: "lead@example.com",
      company: "Acme",
    });

    // An open deal (lead stage) worth $5k.
    createDeal(user.id, {
      title: "Acme demo",
      contactId: contact.id,
      stage: "lead",
      amount: 5000,
      currency: "USD",
    });

    const stats = computeStats(user.id);
    expect(stats.newEmails).toBeGreaterThanOrEqual(1);
    expect(stats.newContacts).toBeGreaterThanOrEqual(1);
    expect(stats.openPipelineValue).toBeGreaterThanOrEqual(5000);
    expect(stats.dealsByStage.lead).toBeGreaterThanOrEqual(1);
  });

  it("does not count closed deals in open pipeline value", () => {
    const user = makeUser();
    const contact = upsertContact(user.id, {
      name: "Closed Co",
      email: "closed@example.com",
    });
    createDeal(user.id, {
      title: "Closed deal",
      contactId: contact.id,
      stage: "won",
      amount: 100000,
      currency: "USD",
    });
    const stats = computeStats(user.id);
    expect(stats.openPipelineValue).toBe(0);
    expect(stats.dealsByStage.won).toBeUndefined();
  });
});

describe("renderDigestBody", () => {
  it("includes the headline and stats lines", () => {
    const user = makeUser();
    const stats = computeStats(user.id);
    const body = renderDigestBody(user, stats, "Headline paragraph here.");
    expect(body).toContain("Shop");
    expect(body).toContain("Headline paragraph here.");
    expect(body).toContain("New emails:");
    expect(body).toContain("Open pipeline value:");
    expect(body).toContain("https://test.example");
  });
});

describe("buildUserDigest (heuristic path)", () => {
  it("returns a digest with a subject, body, and heuristic headline", async () => {
    const user = makeUser();
    const digest = await buildUserDigest(user);
    expect(digest.subject).toContain("Focus for this week");
    expect(digest.body.length).toBeGreaterThan(50);
    expect(digest.headline.length).toBeGreaterThan(0);
  });
});
