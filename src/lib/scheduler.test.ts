import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { __resetDbForTests } from "./store";
import { dueSlot, isSchedulerEnabled, tick, type ScheduledJob } from "./scheduler";

let tmpDir: string;
const savedEnv: Record<string, string | undefined> = {};
const ENV_OVERRIDES = ["SMB_AI_OPS_DATA_DIR", "SMB_AI_OPS_SCHEDULER", "NODE_ENV"] as const;

beforeEach(() => {
  for (const key of ENV_OVERRIDES) savedEnv[key] = process.env[key];
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-scheduler-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  __resetDbForTests();
});

afterEach(() => {
  __resetDbForTests();
  for (const key of ENV_OVERRIDES) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else (process.env as Record<string, string>)[key] = savedEnv[key]!;
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// 2026-10-26 is a Monday.
const MON_0900 = new Date("2026-10-26T09:00:00Z");
const MON_1400 = new Date("2026-10-26T14:00:00Z");
const TUE_1400 = new Date("2026-10-27T14:00:00Z");

describe("dueSlot", () => {
  it("minute jobs are always due and never recorded", () => {
    expect(dueSlot({ every: "minute" }, MON_0900)).toBe("");
  });

  it("daily jobs are due from their hour onward, keyed by UTC date", () => {
    const daily = { every: "day", hourUtc: 14 } as const;
    expect(dueSlot(daily, MON_0900)).toBeNull();
    expect(dueSlot(daily, MON_1400)).toBe("2026-10-26");
    expect(dueSlot(daily, new Date("2026-10-26T23:59:00Z"))).toBe("2026-10-26");
  });

  it("weekly jobs are due only on their day", () => {
    const weekly = { every: "week", dayUtc: 1, hourUtc: 13 } as const;
    expect(dueSlot(weekly, MON_1400)).toBe("2026-10-26");
    expect(dueSlot(weekly, TUE_1400)).toBeNull();
  });
});

describe("tick", () => {
  function counter(cadence: ScheduledJob["cadence"]) {
    const job = { name: `test-${Math.random()}`, cadence, calls: 0, run: () => {} };
    job.run = () => {
      job.calls++;
    };
    return job;
  }

  it("runs a daily job once per day, even across repeated ticks", async () => {
    const job = counter({ every: "day", hourUtc: 14 });
    await tick(MON_0900, [job]);
    expect(job.calls).toBe(0);
    await tick(MON_1400, [job]);
    await tick(new Date("2026-10-26T14:01:00Z"), [job]);
    expect(job.calls).toBe(1);
    await tick(TUE_1400, [job]);
    expect(job.calls).toBe(2);
  });

  it("remembers a firing across a restart", async () => {
    const job = counter({ every: "day", hourUtc: 14 });
    await tick(MON_1400, [job]);
    __resetDbForTests(); // simulate a new process opening the same DB
    await tick(MON_1400, [job]);
    expect(job.calls).toBe(1);
  });

  it("runs minute jobs every tick and skips disabled jobs", async () => {
    const minute = counter({ every: "minute" });
    const disabled = { ...counter({ every: "minute" }), enabled: () => false };
    await tick(MON_0900, [minute, disabled]);
    await tick(MON_0900, [minute, disabled]);
    expect(minute.calls).toBe(2);
    expect(disabled.calls).toBe(0);
  });

  it("keeps going when a job throws", async () => {
    const boom: ScheduledJob = {
      name: "boom",
      cadence: { every: "minute" },
      run: () => {
        throw new Error("boom");
      },
    };
    const ok = counter({ every: "minute" });
    await tick(MON_0900, [boom, ok]);
    expect(ok.calls).toBe(1);
  });
});

describe("isSchedulerEnabled", () => {
  it("defaults on in production only, and honors the override", () => {
    delete process.env.SMB_AI_OPS_SCHEDULER;
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(isSchedulerEnabled()).toBe(true);
    (process.env as Record<string, string>).NODE_ENV = "development";
    expect(isSchedulerEnabled()).toBe(false);
    process.env.SMB_AI_OPS_SCHEDULER = "on";
    expect(isSchedulerEnabled()).toBe(true);
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.SMB_AI_OPS_SCHEDULER = "off";
    expect(isSchedulerEnabled()).toBe(false);
  });
});
