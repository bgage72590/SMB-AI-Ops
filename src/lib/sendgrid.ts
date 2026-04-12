import crypto from "node:crypto";

// Thin SendGrid client. We hit the v3 Mail Send API directly with fetch
// so we don't need the @sendgrid/mail dependency.
//
// Inbound webhooks are handled in src/app/api/webhooks/sendgrid/inbound/route.ts

export interface SendGridInboundPayload {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: string;
  envelope?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string; // plain text
  replyTo?: string;
}

export interface SendEmailResult {
  ok: true;
  messageId: string;
  submittedAt: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL
  );
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error(
      "SendGrid is not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL."
    );
  }

  const payload: Record<string, unknown> = {
    personalizations: [{ to: [{ email: input.to }] }],
    from: { email: from },
    subject: input.subject,
    content: [{ type: "text/plain", value: input.body }],
  };
  if (input.replyTo) {
    payload.reply_to = { email: input.replyTo };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `SendGrid send failed (${response.status}): ${text || response.statusText}`
    );
  }

  // SendGrid returns 202 Accepted with the message ID in the header
  const messageId = response.headers.get("x-message-id") || crypto.randomUUID();

  return {
    ok: true,
    messageId,
    submittedAt: new Date().toISOString(),
  };
}

// ---------- Inbound webhook auth ----------
//
// SendGrid Inbound Parse sends POST requests with multipart/form-data.
// Auth options:
//   1) HMAC verification via SENDGRID_WEBHOOK_VERIFICATION_KEY
//   2) Basic auth via SENDGRID_INBOUND_SECRET (simpler setup)
//
// If neither is set, requests are rejected.

export function isWebhookAuthConfigured(): boolean {
  return Boolean(
    process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY ||
    process.env.SENDGRID_INBOUND_SECRET
  );
}

export function verifyInboundAuth(
  request: Request,
  _rawBody?: string
): boolean {
  // Check for verification key (signed event webhook)
  const verificationKey = process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY;
  if (verificationKey) {
    const signature = request.headers.get("x-twilio-email-event-webhook-signature");
    const timestamp = request.headers.get("x-twilio-email-event-webhook-timestamp");
    if (signature && timestamp && _rawBody) {
      return verifySignature(verificationKey, signature, timestamp, _rawBody);
    }
  }

  // Fallback: shared secret via Basic Auth or query param
  const secret = process.env.SENDGRID_INBOUND_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth && auth.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
      const colonIdx = decoded.indexOf(":");
      const pass = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
      if (timingSafeEqual(pass, secret)) return true;
    } catch {
      // fall through
    }
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token && timingSafeEqual(token, secret)) return true;

  return false;
}

function verifySignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  payload: string
): boolean {
  try {
    const verify = crypto.createVerify("sha256");
    verify.update(timestamp + payload);
    verify.end();
    return verify.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
