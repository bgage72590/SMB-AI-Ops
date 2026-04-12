// Gmail OAuth integration. Allows users to connect their Gmail account
// so the platform can read incoming emails directly instead of relying
// on email forwarding. Uses the same GOOGLE_CLIENT_ID/SECRET as the
// calendar integration but requests additional Gmail scopes.
//
// The OAuth redirect URI is /api/gmail/callback.

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.labels",
].join(" ");

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function isGmailOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export function getGmailRedirectUri(): string {
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/gmail/callback`;
}

export function buildGmailAuthUrl(state?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  if (state) params.set("state", state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface GmailTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function exchangeGmailCode(
  code: string
): Promise<GmailTokenSet> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGmailRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!data.refresh_token) {
    throw new Error(
      "No refresh_token received. Re-authorize with prompt=consent."
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshGmailToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gmail token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  date: string;
}

/**
 * Fetch recent messages from the user's Gmail inbox. Uses the Gmail API
 * messages.list + messages.get endpoints. Returns parsed email objects
 * ready for ingestion into the platform's email pipeline.
 */
export async function fetchRecentMessages(
  accessToken: string,
  opts: { maxResults?: number; after?: string } = {}
): Promise<GmailMessage[]> {
  const maxResults = opts.maxResults ?? 20;
  let q = "in:inbox";
  if (opts.after) {
    q += ` after:${opts.after}`;
  }

  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`;
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const text = await listRes.text().catch(() => "");
    throw new Error(`Gmail list failed (${listRes.status}): ${text}`);
  }

  const listData = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };

  if (!listData.messages || listData.messages.length === 0) return [];

  const messages: GmailMessage[] = [];
  for (const stub of listData.messages) {
    const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${stub.id}?format=full`;
    const msgRes = await fetch(msgUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!msgRes.ok) continue;

    const msgData = (await msgRes.json()) as {
      id: string;
      threadId: string;
      payload: {
        headers: Array<{ name: string; value: string }>;
        body?: { data?: string };
        parts?: Array<{
          mimeType: string;
          body?: { data?: string };
        }>;
      };
      internalDate: string;
    };

    const headers = msgData.payload.headers;
    const getHeader = (name: string) =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ||
      "";

    const fromRaw = getHeader("From");
    const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
    const fromName = fromMatch ? fromMatch[1].replace(/^"|"$/g, "") : undefined;
    const fromEmail = fromMatch ? fromMatch[2] : fromRaw;

    let body = "";
    if (msgData.payload.parts) {
      const textPart = msgData.payload.parts.find(
        (p) => p.mimeType === "text/plain"
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64url").toString("utf-8");
      }
    } else if (msgData.payload.body?.data) {
      body = Buffer.from(msgData.payload.body.data, "base64url").toString(
        "utf-8"
      );
    }

    messages.push({
      id: msgData.id,
      threadId: msgData.threadId,
      from: fromEmail,
      fromName,
      to: getHeader("To"),
      subject: getHeader("Subject"),
      body,
      date: new Date(parseInt(msgData.internalDate)).toISOString(),
    });
  }

  return messages;
}

/**
 * Get the user's Gmail profile (email address).
 */
export async function getGmailProfile(
  accessToken: string
): Promise<{ email: string }> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Gmail profile failed (${res.status})`);
  }
  const data = (await res.json()) as { emailAddress: string };
  return { email: data.emailAddress };
}
