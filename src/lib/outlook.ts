// Microsoft Outlook OAuth integration. Allows users to connect their
// Outlook/Microsoft 365 account for direct email reading. Uses the
// Microsoft Identity Platform (OAuth 2.0) and Microsoft Graph API.
//
// Env vars:
//   MICROSOFT_CLIENT_ID     — from Azure AD app registration
//   MICROSOFT_CLIENT_SECRET — from Azure AD app registration
//   APP_BASE_URL            — for redirect URI

const MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0";
const GRAPH_URL = "https://graph.microsoft.com/v1.0";
const SCOPES = "openid email Mail.Read offline_access";

export function isOutlookOAuthConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );
}

export function getOutlookRedirectUri(): string {
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/outlook/callback`;
}

export function buildOutlookAuthUrl(state?: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID is not set.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getOutlookRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    response_mode: "query",
  });
  if (state) params.set("state", state);
  return `${MS_AUTH_URL}/authorize?${params}`;
}

export interface OutlookTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function exchangeOutlookCode(
  code: string
): Promise<OutlookTokenSet> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth is not configured.");
  }

  const res = await fetch(`${MS_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getOutlookRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Outlook token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshOutlookToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth is not configured.");
  }

  const res = await fetch(`${MS_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Outlook token refresh failed (${res.status}): ${text}`);
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

export interface OutlookMessage {
  id: string;
  conversationId: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  date: string;
}

export async function fetchRecentOutlookMessages(
  accessToken: string,
  opts: { top?: number; after?: string } = {}
): Promise<OutlookMessage[]> {
  const top = opts.top ?? 20;
  let url = `${GRAPH_URL}/me/mailFolders/inbox/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,conversationId,from,toRecipients,subject,body,receivedDateTime`;

  if (opts.after) {
    url += `&$filter=receivedDateTime ge ${opts.after}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Outlook messages failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    value: Array<{
      id: string;
      conversationId: string;
      from: {
        emailAddress: { name?: string; address: string };
      };
      toRecipients: Array<{
        emailAddress: { address: string };
      }>;
      subject: string;
      body: { contentType: string; content: string };
      receivedDateTime: string;
    }>;
  };

  return data.value.map((msg) => ({
    id: msg.id,
    conversationId: msg.conversationId,
    from: msg.from.emailAddress.address,
    fromName: msg.from.emailAddress.name,
    to: msg.toRecipients.map((r) => r.emailAddress.address).join(", "),
    subject: msg.subject,
    body:
      msg.body.contentType === "text"
        ? msg.body.content
        : msg.body.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    date: msg.receivedDateTime,
  }));
}

export async function getOutlookProfile(
  accessToken: string
): Promise<{ email: string; name?: string }> {
  const res = await fetch(`${GRAPH_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Outlook profile failed (${res.status})`);
  }
  const data = (await res.json()) as {
    mail?: string;
    userPrincipalName: string;
    displayName?: string;
  };
  return {
    email: data.mail || data.userPrincipalName,
    name: data.displayName,
  };
}
