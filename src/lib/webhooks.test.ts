import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import dns from "node:dns";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import {
  __resetDbForTests,
  createEmail,
  createUserRow,
  createWebhookEndpoint,
  listRecentDeliveries,
  listRecentJobs,
} from "./store";
import { hashPassword } from "./auth";
import { runJobs } from "./jobs";
import { processEmail } from "./pipeline";
import { emitWebhookEvent, isBlockedAddress, webhookUrlProblem } from "./webhooks";

let tmpDir: string;
let userId: string;
const savedEnv: Record<string, string | undefined> = {};
const ENV_OVERRIDES = ["SMB_AI_OPS_DATA_DIR", "ANTHROPIC_API_KEY", "WEBHOOKS_ALLOW_PRIVATE", "NODE_ENV"] as const;

// A local receiver standing in for Zapier & co.
let server: http.Server;
let port: number;
let received: Array<{ headers: http.IncomingHttpHeaders; body: string }>;
let replyStatus: number;

beforeEach(async () => {
  for (const key of ENV_OVERRIDES) savedEnv[key] = process.env[key];
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.WEBHOOKS_ALLOW_PRIVATE;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smb-ai-ops-webhooks-"));
  process.env.SMB_AI_OPS_DATA_DIR = tmpDir;
  __resetDbForTests();
  userId = createUserRow({
    email: "hooks@example.test",
    name: "Hooks",
    passwordHash: hashPassword("pw-12345678"),
  }).id;

  received = [];
  replyStatus = 200;
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ headers: req.headers, body });
      res.statusCode = replyStatus;
      res.end("ok");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise((r) => server.close(r));
  __resetDbForTests();
  for (const key of ENV_OVERRIDES) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else (process.env as Record<string, string>)[key] = savedEnv[key]!;
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("webhook URL checks", () => {
  it("refuses internal and non-https targets in production", () => {
    (process.env as Record<string, string>).NODE_ENV = "production";
    for (const url of [
      "http://hooks.example.com/x",
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://10.1.2.3/x",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/x",
      "https://[::ffff:192.168.1.1]/x",
      "https://user:pw@hooks.example.com/x",
      "not a url",
    ]) {
      expect(webhookUrlProblem(url), url).not.toBeNull();
    }
    expect(webhookUrlProblem("https://hooks.zapier.com/hooks/catch/1/abc")).toBeNull();
  });

  it("classifies addresses", () => {
    expect(isBlockedAddress("172.20.0.5")).toBe(true);
    expect(isBlockedAddress("100.64.1.1")).toBe(true);
    expect(isBlockedAddress("fd00::1")).toBe(true);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("2606:4700::1111")).toBe(false);
  });
});

describe("webhook delivery", () => {
  it("queues pipeline events and delivers them signed, off the request path", async () => {
    process.env.WEBHOOKS_ALLOW_PRIVATE = "1"; // the test receiver is on loopback
    createWebhookEndpoint(userId, {
      url: `http://127.0.0.1:${port}/hook`,
      events: ["contact.created", "email.processed"],
      secret: "whsec",
    });

    const email = createEmail(userId, {
      from: "newlead@example.com",
      fromName: "New Lead",
      to: "me@example.test",
      subject: "Interested in a quote",
      body: "Can you quote a new deck? Budget around $8k.",
    });
    await processEmail(userId, email);
    expect(received).toHaveLength(0); // nothing sent inline

    await runJobs();
    const events = received.map((r) => JSON.parse(r.body).event).sort();
    expect(events).toEqual(["contact.created", "email.processed"]);

    for (const { headers, body } of received) {
      const expected = crypto.createHmac("sha256", "whsec").update(body).digest("hex");
      expect(headers["x-webhook-signature"]).toBe(`sha256=${expected}`);
    }
  });

  it("only sends events an endpoint subscribed to", async () => {
    process.env.WEBHOOKS_ALLOW_PRIVATE = "1";
    createWebhookEndpoint(userId, { url: `http://127.0.0.1:${port}/hook`, events: ["deal.created"] });
    emitWebhookEvent(userId, "contact.created", { contact: {} });
    await runJobs();
    expect(received).toHaveLength(0);
  });

  it("records failures and retries them", async () => {
    process.env.WEBHOOKS_ALLOW_PRIVATE = "1";
    replyStatus = 500;
    const endpoint = createWebhookEndpoint(userId, { url: `http://127.0.0.1:${port}/hook`, events: [] });
    emitWebhookEvent(userId, "deal.created", { deal: { id: "d1" } });
    await runJobs();

    expect(received).toHaveLength(1);
    expect(listRecentDeliveries(endpoint.id)[0]).toMatchObject({ status: 500 });
    const job = listRecentJobs(5).find((j) => j.type === "deliver_webhook");
    expect(job?.status).toBe("pending"); // backed off, will retry
  });

  it("refuses a hostname that resolves to an internal address at connect time", async () => {
    // Passes the save-time check (a public-looking name), then DNS points
    // it at the loopback receiver: the connection must not be made.
    const endpoint = createWebhookEndpoint(userId, { url: `http://rebind.example.com:${port}/hook`, events: [] });
    vi.spyOn(dns, "lookup").mockImplementation(((
      _host: string,
      _opts: unknown,
      cb: (err: null, addrs: dns.LookupAddress[]) => void
    ) => cb(null, [{ address: "127.0.0.1", family: 4 }])) as unknown as typeof dns.lookup);

    emitWebhookEvent(userId, "deal.created", { deal: { id: "d1" } });
    await runJobs();

    expect(received).toHaveLength(0);
    expect(listRecentDeliveries(endpoint.id)[0].response).toMatch(/refusing internal address 127\.0\.0\.1/);
  });
});
