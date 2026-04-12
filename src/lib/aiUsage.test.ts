import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { estimateCost, logAiUsage } from "./aiUsage";
import {
  __resetDbForTests,
  createUserRow,
  listAiUsage,
  recordAiUsage,
  sumAiUsageSince,
} from "./store";

let tmpDir: string;
let userId: string;
const savedEnv: Record<string, string | undefined> = {};
const ENV_OVERRIDES = ["SMB_AI_OPS_DATA_DIR"] as const;

beforeEach(() => {
  for (const key of ENV_OVERRIDES) savedEnv[key] = process.env[key];
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-aiusage-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  __resetDbForTests();
  const user = createUserRow({
    email: `aiusage-${Date.now()}@example.test`,
    passwordHash: "scrypt$aa$bb",
    name: "AI User",
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

describe("estimateCost", () => {
  it("computes the Opus 4.6 rate for a simple input/output split", () => {
    const cost = estimateCost("claude-opus-4-6", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    // $15 + $75 = $90
    expect(cost).toBeCloseTo(90, 5);
  });

  it("applies the cached-read discount", () => {
    const cost = estimateCost("claude-opus-4-6", {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(1.5, 5);
  });

  it("applies the cache-write premium", () => {
    const cost = estimateCost("claude-opus-4-6", {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(18.75, 5);
  });

  it("falls back to Opus pricing for unknown models", () => {
    const unknown = estimateCost("claude-future-42", {
      input_tokens: 1_000_000,
      output_tokens: 0,
    });
    expect(unknown).toBeCloseTo(15, 5);
  });

  it("returns 0 when there's no usage info", () => {
    expect(estimateCost("claude-opus-4-6", {})).toBe(0);
  });
});

describe("recordAiUsage / sumAiUsageSince", () => {
  it("persists a row and rolls it into the summary", () => {
    recordAiUsage({
      userId,
      kind: "triage",
      model: "claude-opus-4-6",
      inputTokens: 500,
      outputTokens: 250,
      cachedInputTokens: 1000,
      cacheCreationTokens: 0,
      estimatedCostUsd: 0.042,
    });
    recordAiUsage({
      userId,
      kind: "draft",
      model: "claude-opus-4-6",
      inputTokens: 300,
      outputTokens: 400,
      estimatedCostUsd: 0.058,
    });

    const summary = sumAiUsageSince(userId, "1970-01-01T00:00:00.000Z");
    expect(summary.calls).toBe(2);
    expect(summary.totalInputTokens).toBe(800);
    expect(summary.totalOutputTokens).toBe(650);
    expect(summary.totalCachedInputTokens).toBe(1000);
    expect(summary.totalCostUsd).toBeCloseTo(0.1, 5);
  });

  it("excludes rows older than the since timestamp", () => {
    recordAiUsage({
      userId,
      kind: "triage",
      model: "claude-opus-4-6",
      inputTokens: 100,
      outputTokens: 100,
      estimatedCostUsd: 0.01,
    });
    const future = new Date(Date.now() + 60_000).toISOString();
    const summary = sumAiUsageSince(userId, future);
    expect(summary.calls).toBe(0);
    expect(summary.totalCostUsd).toBe(0);
  });

  it("scopes usage rows per user", () => {
    const other = createUserRow({
      email: "other-ai@example.test",
      passwordHash: "scrypt$cc$dd",
      name: "Other",
    });
    recordAiUsage({
      userId,
      kind: "triage",
      model: "claude-opus-4-6",
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0.001,
    });
    recordAiUsage({
      userId: other.id,
      kind: "triage",
      model: "claude-opus-4-6",
      inputTokens: 2,
      outputTokens: 2,
      estimatedCostUsd: 0.002,
    });

    expect(listAiUsage(userId)).toHaveLength(1);
    expect(listAiUsage(other.id)).toHaveLength(1);
    expect(sumAiUsageSince(userId, "1970-01-01").totalInputTokens).toBe(1);
    expect(sumAiUsageSince(other.id, "1970-01-01").totalInputTokens).toBe(2);
  });
});

describe("logAiUsage", () => {
  it("writes a row with the cost derived from the pricing table", () => {
    logAiUsage({
      userId,
      kind: "triage",
      model: "claude-opus-4-6",
      usage: {
        input_tokens: 1_000_000,
        output_tokens: 0,
      },
    });
    const rows = listAiUsage(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("triage");
    expect(rows[0].estimatedCostUsd).toBeCloseTo(15, 5);
  });

  it("swallows logging errors instead of throwing", () => {
    // Passing an empty userId makes the FK insert fail. logAiUsage must
    // swallow the error so the AI call itself isn't punished for a
    // bookkeeping problem.
    expect(() =>
      logAiUsage({
        userId: "",
        kind: "triage",
        model: "claude-opus-4-6",
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    ).not.toThrow();
  });
});
