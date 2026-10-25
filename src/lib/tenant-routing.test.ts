import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  __resetDbForTests,
  createUserRow,
  findUserBySmsNumber,
  listEmails,
  listSmsMessages,
  setUserSlack,
  setUserSmsNumber,
  upsertContact,
} from "./store";
import { hashPassword } from "./auth";
import { inboundRecipients } from "./sendgrid";
import { verifyTwilioSignature } from "./twilio";
import type { User } from "./types";
import { POST as sendgridInbound } from "@/app/api/webhooks/sendgrid/inbound/route";
import { POST as twilioIncoming } from "@/app/api/webhooks/twilio/incoming/route";
import { POST as slackEvents } from "@/app/api/webhooks/slack/route";

// Inbound email, SMS and Slack must land in the workspace that owns the
// address, number or channel, and nowhere else. These tests drive the
// real route handlers with two tenants side by side.

let tmpDir: string;
let alice: User;
let bob: User;
const savedEnv: Record<string, string | undefined> = {};
const ENV_OVERRIDES = [
  "SMB_AI_OPS_DATA_DIR",
  "ANTHROPIC_API_KEY",
  "JOB_QUEUE_MODE",
  "SENDGRID_INBOUND_SECRET",
  "SENDGRID_WEBHOOK_VERIFICATION_KEY",
  "TWILIO_AUTH_TOKEN",
  "APP_BASE_URL",
  "SLACK_SIGNING_SECRET",
] as const;

function makeUser(name: string, inboundAddress: string): User {
  return createUserRow({
    email: `${name}@example.test`,
    name,
    passwordHash: hashPassword("pw-12345678"),
    inboundAddress,
  });
}

beforeEach(() => {
  for (const key of ENV_OVERRIDES) savedEnv[key] = process.env[key];
  delete process.env.ANTHROPIC_API_KEY; // heuristic pipeline
  delete process.env.JOB_QUEUE_MODE;
  delete process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  process.env.SENDGRID_INBOUND_SECRET = "sg-secret";
  process.env.TWILIO_AUTH_TOKEN = "tw-token";
  process.env.APP_BASE_URL = "https://app.example.test";
  process.env.SLACK_SIGNING_SECRET = "slack-secret";
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-routing-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  __resetDbForTests();
  // Alice signs up first, so she's the account the old code fell back to.
  alice = makeUser("alice", "alice-1a2b@inbound.test");
  bob = makeUser("bob", "bob-3c4d@inbound.test");
});

afterEach(() => {
  __resetDbForTests();
  for (const key of ENV_OVERRIDES) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------- Email ----------

function inboundEmail(fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request("http://localhost/api/webhooks/sendgrid/inbound?token=sg-secret", {
    method: "POST",
    body: form,
  });
}

const subjects = (user: User) => listEmails(user.id).map((e) => e.subject);

describe("inboundRecipients", () => {
  it("uses only the envelope when there is one", () => {
    expect(
      inboundRecipients({
        from: "x@example.com",
        subject: "s",
        to: "Shop <shop@realbusiness.com>",
        envelope: JSON.stringify({ to: ["Bob-3C4D@inbound.test"], from: "x@example.com" }),
      })
    ).toEqual(["bob-3c4d@inbound.test"]);
  });

  it("falls back to To and Cc headers without an envelope", () => {
    expect(
      inboundRecipients({
        from: "x@example.com",
        subject: "s",
        to: '"Doe, Jane" <jane@a.test>, b@b.test',
        cc: "c@c.test, b@b.test",
      })
    ).toEqual(["jane@a.test", "b@b.test", "c@c.test"]);
  });
});

describe("SendGrid inbound routing", () => {
  it("routes forwarded mail by envelope, not the To header", async () => {
    // Gmail forwarding keeps the business's own address in To.
    const res = await sendgridInbound(
      inboundEmail({
        from: "Lead <lead@example.com>",
        to: "Bob's Shop <hello@bobsshop.com>",
        subject: "Forwarded quote request",
        text: "Can you quote a fence?",
        envelope: JSON.stringify({ to: [bob.inboundAddress], from: "lead@example.com" }),
      })
    );
    expect(res.status).toBe(200);
    expect(subjects(bob)).toContain("Forwarded quote request");
    expect(subjects(alice)).not.toContain("Forwarded quote request");
  });

  it("drops mail nobody owns instead of giving it to the first account", async () => {
    const res = await sendgridInbound(
      inboundEmail({
        from: "lead@example.com",
        to: "deleted-user@inbound.test",
        subject: "To a deleted workspace",
        text: "hello",
        envelope: JSON.stringify({ to: ["deleted-user@inbound.test"] }),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ delivered: 0 });
    expect(subjects(alice)).not.toContain("To a deleted workspace");
    expect(subjects(bob)).not.toContain("To a deleted workspace");
  });

  it("delivers one copy to each workspace a message is addressed to", async () => {
    await sendgridInbound(
      inboundEmail({
        from: "lead@example.com",
        to: `${alice.inboundAddress}, ${bob.inboundAddress}`,
        subject: "To both",
        text: "hi",
        envelope: JSON.stringify({ to: [alice.inboundAddress, bob.inboundAddress] }),
      })
    );
    expect(subjects(alice).filter((s) => s === "To both")).toHaveLength(1);
    expect(subjects(bob).filter((s) => s === "To both")).toHaveLength(1);
  });

  it("still requires the webhook secret", async () => {
    const form = new FormData();
    form.set("from", "lead@example.com");
    form.set("to", bob.inboundAddress!);
    form.set("subject", "No token");
    const res = await sendgridInbound(
      new Request("http://localhost/api/webhooks/sendgrid/inbound", { method: "POST", body: form })
    );
    expect(res.status).toBe(401);
  });
});

// ---------- SMS ----------

const TWILIO_URL = "https://app.example.test/api/webhooks/twilio/incoming";

function signTwilio(params: Record<string, string>, token = "tw-token"): string {
  const data =
    TWILIO_URL +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  return createHmac("sha1", token).update(data).digest("base64");
}

function inboundSms(params: Record<string, string>, signature = signTwilio(params)) {
  // The server sees its internal address; the signature covers the public one.
  return new Request("http://127.0.0.1:3000/api/webhooks/twilio/incoming", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": signature,
    },
    body: new URLSearchParams(params).toString(),
  });
}

describe("Twilio signature", () => {
  it("matches Twilio's documented example", () => {
    expect(
      verifyTwilioSignature(
        "12345",
        "https://mycompany.com/myapp.php?foo=1&bar=2",
        [
          ["CallSid", "CA1234567890ABCDE"],
          ["Caller", "+12349013030"],
          ["Digits", "1234"],
          ["From", "+12349013030"],
          ["To", "+18005551212"],
        ],
        "0/KCTR6DLpKmkAf8muzZqo1nDgQ="
      )
    ).toBe(true);
  });
});

describe("Twilio inbound routing", () => {
  const SHARED_CUSTOMER = "+15550001111";

  beforeEach(() => {
    setUserSmsNumber(alice.id, "+1 (555) 100-0001");
    setUserSmsNumber(bob.id, "+15551000002");
    // The same person is a contact in both workspaces.
    upsertContact(alice.id, { name: "Sam", email: "sam@a.test", phone: SHARED_CUSTOMER });
    upsertContact(bob.id, { name: "Sam", email: "sam@b.test", phone: SHARED_CUSTOMER });
  });

  const smsBodies = (user: User) => {
    const contact = upsertContact(user.id, { name: "Sam", email: user === alice ? "sam@a.test" : "sam@b.test" });
    return listSmsMessages(user.id, contact.id).map((m) => m.body);
  };

  it("routes by the number texted, not by who has the sender as a contact", async () => {
    const params = { From: SHARED_CUSTOMER, To: "+15551000002", Body: "For Bob", MessageSid: "SM1" };
    const res = await twilioIncoming(inboundSms(params));
    expect(res.status).toBe(200);
    expect(smsBodies(bob)).toEqual(["For Bob"]);
    expect(smsBodies(alice)).toEqual([]);
  });

  it("rejects forged texts", async () => {
    const params = { From: SHARED_CUSTOMER, To: "+15551000002", Body: "wire the deposit", MessageSid: "SM2" };
    const forged = await twilioIncoming(inboundSms(params, signTwilio(params, "wrong-token")));
    expect(forged.status).toBe(403);
    const unsigned = await twilioIncoming(inboundSms(params, ""));
    expect(unsigned.status).toBe(403);
    expect(smsBodies(bob)).toEqual([]);
  });

  it("drops texts to a number nobody owns", async () => {
    const params = { From: SHARED_CUSTOMER, To: "+15559999999", Body: "Who?", MessageSid: "SM3" };
    expect((await twilioIncoming(inboundSms(params))).status).toBe(200);
    expect(smsBodies(alice)).toEqual([]);
    expect(smsBodies(bob)).toEqual([]);
  });

  it("won't give one number to two workspaces", () => {
    expect(() => setUserSmsNumber(bob.id, "+15551000001")).toThrow();
    expect(findUserBySmsNumber("+1 555 100 0001")?.id).toBe(alice.id);
  });
});

// ---------- Slack ----------

function slackEvent(payload: object) {
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = "v0=" + createHmac("sha256", "slack-secret").update(`v0:${ts}:${body}`).digest("hex");
  return new Request("http://localhost/api/webhooks/slack", {
    method: "POST",
    headers: { "x-slack-request-timestamp": ts, "x-slack-signature": sig },
    body,
  });
}

describe("Slack inbound routing", () => {
  beforeEach(() => {
    setUserSlack(bob.id, {
      teamId: "T_BOB",
      channelId: "C_LEADS",
      channelName: "leads",
      webhookUrl: "https://hooks.slack.test/bob",
    });
  });

  const message = (team: string, channel: string, text: string) =>
    slackEvent({ type: "event_callback", team_id: team, event: { type: "message", user: "U1", channel, text } });

  it("routes a message from the connected channel to its workspace", async () => {
    await slackEvents(message("T_BOB", "C_LEADS", "Can someone call me?"));
    expect(listEmails(bob.id).map((e) => e.body)).toContain("Can someone call me?");
    expect(listEmails(alice.id).map((e) => e.body)).not.toContain("Can someone call me?");
    expect(subjects(bob)).toContain("Slack message in #leads");
  });

  it("ignores other channels and other Slack workspaces", async () => {
    await slackEvents(message("T_BOB", "C_RANDOM", "lunch?"));
    await slackEvents(message("T_OTHER", "C_LEADS", "not yours"));
    for (const user of [alice, bob]) {
      const bodies = listEmails(user.id).map((e) => e.body);
      expect(bodies).not.toContain("lunch?");
      expect(bodies).not.toContain("not yours");
    }
  });
});
