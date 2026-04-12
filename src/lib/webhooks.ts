import crypto from "node:crypto";
import {
  createWebhookDelivery,
  getEnabledWebhookEndpoints,
} from "./store";
import type { WebhookEndpoint, WebhookEvent } from "./types";

/**
 * Fire a webhook event for a given user. Finds all enabled endpoints
 * subscribed to this event and delivers the payload to each.
 *
 * Delivery is best-effort and non-blocking — failures are logged in the
 * webhook_deliveries table but don't throw.
 */
export async function emitWebhookEvent(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  const endpoints = getEnabledWebhookEndpoints(userId, event);
  if (endpoints.length === 0) return;

  const payload = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data,
  });

  const deliveries = endpoints.map((ep) => deliverWebhook(ep, event, payload));
  await Promise.allSettled(deliveries);
}

async function deliverWebhook(
  endpoint: WebhookEndpoint,
  event: string,
  payload: string
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SMB-AI-Ops-Webhook/1.0",
    "X-Webhook-Event": event,
  };

  if (endpoint.secret) {
    const signature = crypto
      .createHmac("sha256", endpoint.secret)
      .update(payload)
      .digest("hex");
    headers["X-Webhook-Signature"] = `sha256=${signature}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(endpoint.url, {
      method: "POST",
      headers,
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await res.text().catch(() => "");

    createWebhookDelivery({
      endpointId: endpoint.id,
      event,
      payload,
      status: res.status,
      response: responseText.slice(0, 1000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    createWebhookDelivery({
      endpointId: endpoint.id,
      event,
      payload,
      status: 0,
      response: `Delivery failed: ${message}`,
    });
  }
}
