// Thin Twilio client. We hit the REST API directly with fetch (same pattern
// as sendgrid.ts) so we don't pull in another dependency for one endpoint.
//
// One operator Twilio account, one number per workspace. The number is
// what routes inbound texts to the right workspace, so it's assigned by
// the operator (scripts/assign-sms-number.mjs), never chosen by a user.
//
// Env vars:
//   TWILIO_ACCOUNT_SID   — your Twilio account SID (ACxxxx)
//   TWILIO_AUTH_TOKEN    — auth token; also signs inbound webhooks

import { createHmac, timingSafeEqual } from "node:crypto";
import { hasFeature } from "./plans";
import type { User } from "./types";

export interface SendSmsInput {
  to: string;
  /** The workspace's own Twilio number. */
  from: string;
  body: string;
}

export interface SendSmsResult {
  ok: true;
  messageSid: string;
  status: string;
}

/** Operator-level Twilio credentials are present. */
export function isTwilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

/** This workspace can text: its plan includes SMS, Twilio is configured, and it has a number. */
export function canSendSms(user: User): boolean {
  return hasFeature(user, "sms_followups") && isTwilioConfigured() && Boolean(user.smsNumber);
}

/** Why SMS is unavailable for this workspace, for the UI and API errors. */
export function smsUnavailableReason(user: User): string {
  if (!hasFeature(user, "sms_followups")) {
    return "Texting is included in the Starter plan and up. Upgrade under Settings.";
  }
  if (!isTwilioConfigured()) {
    return "SMS isn't set up on this server. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.";
  }
  return "Your workspace doesn't have a texting number yet. Ask support to assign one.";
}

/**
 * Verify Twilio's X-Twilio-Signature: base64 HMAC-SHA1 of the full public
 * URL followed by every POST param (sorted by name, name then value),
 * keyed by the auth token.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Array<[string, string]>,
  signature: string
): boolean {
  if (!signature) return false;
  const sorted = [...params].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const data = url + sorted.map(([k, v]) => k + v).join("");
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The URL Twilio signed. Behind a reverse proxy `request.url` is the
 * internal address, so rebuild it on APP_BASE_URL when that's set.
 */
export function publicWebhookUrl(request: Request): string {
  const base = process.env.APP_BASE_URL;
  if (!base) return request.url;
  const url = new URL(request.url);
  return base.replace(/\/$/, "") + url.pathname + url.search;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }
  if (!input.from) {
    throw new Error("This workspace has no Twilio number assigned.");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64"
  );

  const params = new URLSearchParams({
    To: input.to,
    From: input.from,
    Body: input.body,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Twilio send failed (${response.status}): ${text || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    sid: string;
    status: string;
    error_code: number | null;
    error_message: string | null;
  };

  if (data.error_code) {
    throw new Error(`Twilio send failed: ${data.error_message}`);
  }

  return {
    ok: true,
    messageSid: data.sid,
    status: data.status,
  };
}
