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

// Verify an inbound Postmark request against our shared secret. We accept
// either an Authorization: Bearer <secret> header OR a ?token=<secret> query
// param so you can point any inbound webhook at us, not just Postmark's UI
// (which supports Basic Auth on the URL).
export function verifyInboundSecret(request: Request): boolean {
  const expected = process.env.POSTMARK_INBOUND_SECRET;
  if (!expected) {
    // No secret configured = reject everything. Fail closed.
    return false;
  }

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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
