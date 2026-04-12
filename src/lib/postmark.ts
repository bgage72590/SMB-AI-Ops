import crypto from "node:crypto";

// Thin Postmark client. We hit the REST API directly with fetch so we don't
// pull in another dependency just for one endpoint.
//
// Inbound webhooks are handled in src/app/api/webhooks/postmark/inbound/route.ts
// — the shapes consumed there are also defined here so both sides share one
// source of truth.

export interface PostmarkInboundPayload {
  FromName?: string;
  From: string;
  FromFull?: { Email: string; Name?: string };
  To: string;
  ToFull?: Array<{ Email: string; Name?: string }>;
  Subject: string;
  MessageID?: string;
  Date?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  Headers?: Array<{ Name: string; Value: string }>;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string; // plain text
  replyTo?: string;
  messageStream?: string; // defaults to "outbound"
}

export interface SendEmailResult {
  ok: true;
  messageId: string;
  submittedAt: string;
}

export function isPostmarkConfigured(): boolean {
  return Boolean(
    process.env.POSTMARK_SERVER_TOKEN && process.env.POSTMARK_FROM_EMAIL
  );
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from = process.env.POSTMARK_FROM_EMAIL;
  if (!token || !from) {
    throw new Error(
      "Postmark is not configured. Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL."
    );
  }

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: input.to,
      Subject: input.subject,
      TextBody: input.body,
      ReplyTo: input.replyTo,
      MessageStream: input.messageStream || "outbound",
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Postmark send failed (${response.status}): ${text || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    MessageID: string;
    SubmittedAt: string;
    ErrorCode: number;
    Message: string;
  };

  if (data.ErrorCode && data.ErrorCode !== 0) {
    throw new Error(`Postmark send failed: ${data.Message}`);
  }

  return {
    ok: true,
    messageId: data.MessageID,
    submittedAt: data.SubmittedAt,
  };
}

// ---------- Inbound webhook auth ----------
//
// We support two auth modes on the inbound webhook:
//
//   1) HMAC signature (preferred). When POSTMARK_WEBHOOK_HMAC_SECRET is set,
//      the webhook MUST include an `X-Signature: sha256=<hex>` header whose
//      value matches HMAC-SHA256(secret, rawBody). Postmark itself doesn't
//      sign inbound webhooks natively, but this is the standard shape any
//      signing proxy (or other provider you might point at this endpoint)
//      will produce. This is strictly stronger than shared secret: the
//      secret never travels over the wire, and replaying a captured
//      request against a different body won't validate.
//
//   2) Shared secret fallback. When POSTMARK_WEBHOOK_HMAC_SECRET is NOT set
//      but POSTMARK_INBOUND_SECRET is, we accept either:
//        - Authorization: Bearer <secret>
//        - Authorization: Basic <base64(anything:secret)>   (Postmark UI)
//        - ?token=<secret>                                  (query param)
//
// If neither env var is set, every request is rejected. Fail closed.

export function isHmacConfigured(): boolean {
  return Boolean(process.env.POSTMARK_WEBHOOK_HMAC_SECRET);
}

export function verifyHmacSignature(
  request: Request,
  rawBody: string
): boolean {
  const secret = process.env.POSTMARK_WEBHOOK_HMAC_SECRET;
  if (!secret) return false;

  const header =
    request.headers.get("x-signature") ||
    request.headers.get("x-postmark-signature") ||
    request.headers.get("x-hub-signature-256");
  if (!header) return false;

  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf-8")
    .digest("hex");

  return constantTimeEqualHex(computed, provided);
}

export function verifySharedSecret(request: Request): boolean {
  const expected = process.env.POSTMARK_INBOUND_SECRET;
  if (!expected) return false;

  const auth = request.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) {
    if (timingSafeEqual(auth.slice(7), expected)) return true;
  }

  // Basic auth fallback (Postmark-style user:pass URL). Treat the password as
  // the secret and ignore the username.
  if (auth && auth.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
      const colonIdx = decoded.indexOf(":");
      const pass = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
      if (timingSafeEqual(pass, expected)) return true;
    } catch {
      // fall through
    }
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token && timingSafeEqual(token, expected)) return true;

  return false;
}

// Single entry point callers use. Chooses HMAC when configured, otherwise
// shared secret. Takes the raw body text because HMAC must verify over the
// exact bytes that were sent.
export function verifyInboundAuth(
  request: Request,
  rawBody: string
): boolean {
  if (isHmacConfigured()) return verifyHmacSignature(request, rawBody);
  return verifySharedSecret(request);
}

// Back-compat shim for any code still calling the old name. New callers
// should prefer verifyInboundAuth so HMAC is honored.
export function verifyInboundSecret(request: Request): boolean {
  return verifySharedSecret(request);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
