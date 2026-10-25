// Outbound webhooks: send CRM events to URLs a workspace registered
// (Zapier, Make, their own API).
//
// emitWebhookEvent() never makes a network call in the request. It queues
// one deliver_webhook job per subscribed endpoint; the scheduler drains the
// queue every minute, and failed deliveries retry with the queue's backoff.
//
// The URLs are user-supplied, so every delivery is guarded against server-
// side request forgery: no internal, loopback, link-local or private
// addresses, checked when the URL is saved and again on the address the
// hostname actually resolves to at connect time (so DNS can't be swapped
// in between). Redirects are never followed.

import crypto from "node:crypto";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import {
  createWebhookDelivery,
  enqueueJob,
  getEnabledWebhookEndpoints,
  getWebhookEndpoint,
} from "./store";
import type { WebhookEvent } from "./types";

const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 5;

const BLOCKED = new net.BlockList();
for (const [subnet, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // includes cloud metadata (169.254.169.254)
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(subnet, prefix, "ipv4");
}
for (const [subnet, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96], // NAT64 can reach IPv4 internals
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED.addSubnet(subnet, prefix, "ipv6");
}

/** Local testing escape hatch. Never set this in production. */
function allowPrivate(): boolean {
  return process.env.WEBHOOKS_ALLOW_PRIVATE === "1";
}

export function isBlockedAddress(address: string): boolean {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return BLOCKED.check(mapped, "ipv4");
  if (net.isIPv4(address)) return BLOCKED.check(address, "ipv4");
  if (net.isIPv6(address)) return BLOCKED.check(address, "ipv6");
  return true;
}

/** Why a webhook URL can't be used, or null if it's fine. */
export function webhookUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Not a valid URL.";
  }
  const httpOk = process.env.NODE_ENV !== "production" || allowPrivate();
  if (url.protocol !== "https:" && !(httpOk && url.protocol === "http:")) {
    return "Webhook URLs must use https.";
  }
  if (url.username || url.password) return "Put credentials in a signing secret, not the URL.";
  if (allowPrivate()) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return "Webhook URLs must be on the public internet.";
  }
  if (net.isIP(host) && isBlockedAddress(host)) {
    return "Webhook URLs must be on the public internet.";
  }
  return null;
}

/** dns.lookup that refuses to hand back internal addresses. */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad && !allowPrivate()) {
      return callback(new Error(`refusing internal address ${bad.address}`), "", 0);
    }
    if ((options as dns.LookupAllOptions).all) {
      (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    } else {
      callback(null, list[0].address, list[0].family);
    }
  });
};

function postJson(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "https:" ? https : http;
    const req = client.request(
      target,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body).toString() },
        lookup: guardedLookup,
        timeout: DELIVERY_TIMEOUT_MS,
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          if (text.length < 1000) text += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: text.slice(0, 1000) }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    req.end(body);
  });
}

/**
 * Queue an event for every enabled endpoint subscribed to it. Cheap and
 * synchronous: safe to call from request handlers and the pipeline.
 */
export function emitWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): void {
  const endpoints = getEnabledWebhookEndpoints(userId, event);
  if (endpoints.length === 0) return;
  const payload = JSON.stringify({ event, timestamp: new Date().toISOString(), data });
  for (const endpoint of endpoints) {
    enqueueJob({
      type: "deliver_webhook",
      userId,
      payload: { userId, endpointId: endpoint.id, event, body: payload },
      maxAttempts: MAX_ATTEMPTS,
    });
  }
}

/**
 * Send one queued event. Every attempt is recorded in webhook_deliveries;
 * a failure throws so the job queue retries it.
 */
export async function deliverWebhook(input: {
  userId: string;
  endpointId: string;
  event: string;
  body: string;
}): Promise<void> {
  const endpoint = getWebhookEndpoint(input.userId, input.endpointId);
  if (!endpoint || !endpoint.enabled) return; // deleted or turned off since

  const record = (status: number, response: string) =>
    createWebhookDelivery({
      endpointId: endpoint.id,
      event: input.event,
      payload: input.body,
      status,
      response,
    });

  const problem = webhookUrlProblem(endpoint.url);
  if (problem) {
    record(0, `Not sent: ${problem}`);
    return; // retrying won't help
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SMB-AI-Ops-Webhook/1.0",
    "X-Webhook-Event": input.event,
  };
  if (endpoint.secret) {
    const signature = crypto.createHmac("sha256", endpoint.secret).update(input.body).digest("hex");
    headers["X-Webhook-Signature"] = `sha256=${signature}`;
  }

  let result: { status: number; text: string };
  try {
    result = await postJson(endpoint.url, headers, input.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    record(0, `Delivery failed: ${message}`);
    throw new Error(`webhook ${endpoint.id}: ${message}`);
  }
  record(result.status, result.text);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`webhook ${endpoint.id}: HTTP ${result.status}`);
  }
}
