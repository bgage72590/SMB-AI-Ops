import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Route handlers read the session from next/headers; point it at whatever
// session the test signs in with.
let sessionId: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "smb_session" && sessionId ? { value: sessionId } : undefined),
  }),
}));

import {
  __resetDbForTests,
  createEmail,
  createSessionRow,
  createUserRow,
  getUsageToday,
  getUserById,
  listEmails,
  setUserSmsNumber,
  tryConsumeUsage,
  updateUserStripe,
  upsertContact,
} from "./store";
import { hashPassword, issueEmailVerification, signup, verifyEmail, SESSION_COOKIE } from "./auth";
import { chargePaid, GuardError } from "./guard";
import { dailyLimit, effectiveTier, TRIAL_DAILY_LIMITS, DAILY_LIMITS } from "./plans";
import { triageEmailSafe } from "./ai";
import { processEmail } from "./pipeline";
import type { User } from "./types";
import { POST as createContact } from "@/app/api/contacts/route";
import { POST as sendSmsRoute } from "@/app/api/sms/route";
import { GET as reportsRoute } from "@/app/api/reports/route";

const DAY = 24 * 60 * 60 * 1000;
let tmpDir: string;
const savedEnv: Record<string, string | undefined> = {};
const ENV_OVERRIDES = [
  "SMB_AI_OPS_DATA_DIR",
  "ANTHROPIC_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
] as const;

beforeEach(() => {
  for (const key of ENV_OVERRIDES) savedEnv[key] = process.env[key];
  delete process.env.ANTHROPIC_API_KEY;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-guard-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  __resetDbForTests();
  sessionId = undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
  __resetDbForTests();
  for (const key of ENV_OVERRIDES) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let seq = 0;
/** A user in a given plan state. Verified unless told otherwise. */
function makeUser(
  state: "trial" | "expired-trial" | "starter" | "pro" | "canceled",
  opts: { verified?: boolean } = {}
): User {
  const user = createUserRow({
    email: `u${++seq}@example.test`,
    name: `User ${seq}`,
    passwordHash: hashPassword("pw-12345678"),
  });
  const trialEndsAt = new Date(Date.now() + (state === "trial" ? 10 : -1) * DAY).toISOString();
  if (state === "trial" || state === "expired-trial") updateUserStripe(user.id, { trialEndsAt });
  if (state === "starter" || state === "pro") {
    updateUserStripe(user.id, { planTier: state, subscriptionStatus: "active" });
  }
  if (state === "canceled") {
    updateUserStripe(user.id, { planTier: "pro", subscriptionStatus: "canceled" });
  }
  if (opts.verified === false) {
    // createUserRow leaves new rows unverified; mark the rest verified.
  } else {
    verifyEmail(new URL(issueEmailVerification(user.id), "http://x").searchParams.get("token")!);
  }
  return getUserById(user.id)!;
}

function signIn(user: User) {
  sessionId = `s-${user.id}`;
  createSessionRow({ id: sessionId, userId: user.id, expiresAt: new Date(Date.now() + DAY).toISOString() });
}

const json = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("plans", () => {
  it("gives a running trial Pro features but trial-sized quotas", () => {
    const user = makeUser("trial");
    expect(effectiveTier(user)).toBe("pro");
    expect(dailyLimit(user, "sms")).toBe(TRIAL_DAILY_LIMITS.sms);
  });

  it("drops a lapsed trial or canceled plan to Free, not to locked", () => {
    expect(effectiveTier(makeUser("expired-trial"))).toBe("free");
    expect(effectiveTier(makeUser("canceled"))).toBe("free");
    expect(dailyLimit(makeUser("pro"), "sms")).toBe(DAILY_LIMITS.pro.sms);
  });
});

describe("usage metering", () => {
  it("stops at the limit, per kind and account", () => {
    const a = makeUser("pro");
    const b = makeUser("pro");
    expect(tryConsumeUsage(a.id, "sms", 2)).toBe(true);
    expect(tryConsumeUsage(a.id, "sms", 2)).toBe(true);
    expect(tryConsumeUsage(a.id, "sms", 2)).toBe(false);
    expect(getUsageToday(a.id, "sms")).toBe(2);
    expect(tryConsumeUsage(a.id, "email", 2)).toBe(true);
    expect(tryConsumeUsage(b.id, "sms", 2)).toBe(true);
  });

  it("treats 0 as none and -1 as unlimited", () => {
    const user = makeUser("pro");
    expect(tryConsumeUsage(user.id, "sms", 0)).toBe(false);
    expect(getUsageToday(user.id, "sms")).toBe(0);
    for (let i = 0; i < 5; i++) expect(tryConsumeUsage(user.id, "ai", -1)).toBe(true);
  });
});

describe("chargePaid", () => {
  const codeOf = (fn: () => void) => {
    try {
      fn();
      return "allowed";
    } catch (err) {
      return err instanceof GuardError ? err.code : String(err);
    }
  };

  it("needs a verified email", () => {
    expect(codeOf(() => chargePaid(makeUser("pro", { verified: false }), "ai"))).toBe("email_unverified");
  });

  it("needs a plan that includes the provider", () => {
    expect(codeOf(() => chargePaid(makeUser("expired-trial"), "sms"))).toBe("plan_required");
  });

  it("stops at the daily quota", () => {
    const user = makeUser("starter");
    for (let i = 0; i < DAILY_LIMITS.starter.sms; i++) tryConsumeUsage(user.id, "sms", DAILY_LIMITS.starter.sms);
    expect(codeOf(() => chargePaid(user, "sms"))).toBe("quota_exceeded");
  });
});

describe("apiRoute", () => {
  it("returns 401 without a session", async () => {
    const res = await createContact(json({ name: "A", email: "a@example.com" }));
    expect(res.status).toBe(401);
  });

  it("lets a lapsed trial keep using the CRM (Free plan)", async () => {
    signIn(makeUser("expired-trial"));
    const res = await createContact(json({ name: "A", email: "a@example.com" }));
    expect(res.status).toBe(201);
  });

  it("blocks plan features the account doesn't have", async () => {
    signIn(makeUser("expired-trial"));
    const res = await reportsRoute(new Request("http://localhost/api/reports"));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "plan_required" });
  });

  it("rate-limits per account", async () => {
    signIn(makeUser("pro"));
    let last = 0;
    for (let i = 0; i < 121; i++) {
      last = (await createContact(json({ name: `C${i}`, email: `c${i}@example.com` }))).status;
    }
    expect(last).toBe(429);
  });
});

describe("SMS route spend", () => {
  function smsReady(state: "starter" | "pro", opts: { verified?: boolean } = {}) {
    process.env.TWILIO_ACCOUNT_SID = "ACtest";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    const user = makeUser(state, opts);
    setUserSmsNumber(user.id, `+1555000${String(seq).padStart(4, "0")}`);
    const contact = upsertContact(user.id, { name: "Cy", email: "cy@example.com", phone: "+15550000002" });
    signIn(user);
    return { user: getUserById(user.id)!, contact };
  }

  it("sends and counts one SMS", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ sid: "SM1", status: "queued", error_code: null, error_message: null }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const { user, contact } = smsReady("starter");
    const res = await sendSmsRoute(json({ contactId: contact.id, body: "hi" }));
    expect(res.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getUsageToday(user.id, "sms")).toBe(1);
  });

  it("won't call Twilio for an unverified account or past the quota", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const unverified = smsReady("starter", { verified: false });
    const res1 = await sendSmsRoute(json({ contactId: unverified.contact.id, body: "hi" }));
    expect(res1.status).toBe(403);

    const full = smsReady("starter");
    for (let i = 0; i < DAILY_LIMITS.starter.sms; i++) tryConsumeUsage(full.user.id, "sms", DAILY_LIMITS.starter.sms);
    const res2 = await sendSmsRoute(json({ contactId: full.contact.id, body: "hi" }));
    expect(res2.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("background AI spend", () => {
  const email = (userId: string) =>
    createEmail(userId, { from: "x@example.com", to: "me@example.test", subject: "Quote?", body: "Need a quote" });

  it("charges the owner's AI quota, and skips AI when unverified", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    // Any real model call fails fast; triageEmailSafe then uses the heuristic.
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));

    const verified = makeUser("pro");
    await triageEmailSafe(email(verified.id), { userId: verified.id });
    expect(getUsageToday(verified.id, "ai")).toBe(1);

    const unverified = makeUser("pro", { verified: false });
    await triageEmailSafe(email(unverified.id), { userId: unverified.id });
    expect(getUsageToday(unverified.id, "ai")).toBe(0);

    await triageEmailSafe(email(verified.id)); // no account to charge
    expect(getUsageToday(verified.id, "ai")).toBe(1);
  });

  it("leaves over-quota mail unprocessed so it's triaged after an upgrade", async () => {
    const user = makeUser("expired-trial"); // Free: 25 emails / 30 days
    for (let i = 0; i < 25; i++) email(user.id);
    const extra = email(user.id);
    await processEmail(user.id, extra);
    expect(listEmails(user.id).find((e) => e.id === extra.id)?.processed).toBe(false);
  });
});

describe("email verification", () => {
  it("starts new signups unverified and verifies once", () => {
    const { user } = signup({ email: "new@example.test", password: "pw-12345678", name: "New" });
    expect(getUserById(user.id)?.emailVerifiedAt).toBeUndefined();

    const token = new URL(issueEmailVerification(user.id), "http://x").searchParams.get("token")!;
    verifyEmail(token);
    expect(getUserById(user.id)?.emailVerifiedAt).toBeTruthy();
    expect(() => verifyEmail(token)).toThrow(/token_used/);
    expect(() => verifyEmail("not-a-token")).toThrow(/invalid_token/);
  });

  it("uses the cookie name the routes read", () => {
    expect(SESSION_COOKIE).toBe("smb_session");
  });
});
