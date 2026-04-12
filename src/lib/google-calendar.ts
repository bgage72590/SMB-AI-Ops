// Google Calendar integration. Handles OAuth 2.0 and free/busy lookups so
// the AI draft prompt can propose specific appointment times instead of
// generic "what works for you?" language.
//
// Env vars:
//   GOOGLE_CLIENT_ID       — from Google Cloud Console
//   GOOGLE_CLIENT_SECRET   — from Google Cloud Console
//   APP_BASE_URL           — e.g. https://app.smbaiops.com (for redirect URI)

const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FREEBUSY_URL =
  "https://www.googleapis.com/calendar/v3/freeBusy";

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export function getRedirectUri(): string {
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/calendar/callback`;
}

export function buildAuthUrl(state?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set.");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  if (state) params.set("state", state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<TokenSet> {
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
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!data.refresh_token) {
    throw new Error(
      "No refresh_token received. The user may need to re-authorize with prompt=consent."
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function refreshAccessToken(
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
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
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

export interface BusySlot {
  start: string;
  end: string;
}

export interface AvailabilityResult {
  busySlots: BusySlot[];
  windowStart: string;
  windowEnd: string;
}

/**
 * Query Google Calendar free/busy for the next N days. Returns a list of
 * busy periods. The AI draft prompt can invert these to propose open slots.
 */
export async function getAvailability(
  accessToken: string,
  opts: { daysAhead?: number } = {}
): Promise<AvailabilityResult> {
  const daysAhead = opts.daysAhead ?? 5;
  const windowStart = new Date();
  windowStart.setHours(8, 0, 0, 0);
  if (windowStart.getTime() < Date.now()) {
    windowStart.setDate(windowStart.getDate() + 1);
  }
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + daysAhead);
  windowEnd.setHours(18, 0, 0, 0);

  const res = await fetch(FREEBUSY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      items: [{ id: "primary" }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar free/busy failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    calendars: {
      primary: {
        busy: Array<{ start: string; end: string }>;
      };
    };
  };

  return {
    busySlots: data.calendars.primary.busy,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  };
}

/**
 * Format availability for inclusion in an AI draft prompt. Converts busy
 * periods into a human-readable summary the model can use to suggest times.
 */
export function formatAvailabilityForPrompt(
  avail: AvailabilityResult
): string {
  const lines: string[] = [
    `Calendar availability (${new Date(avail.windowStart).toLocaleDateString()} – ${new Date(avail.windowEnd).toLocaleDateString()}):`,
  ];

  if (avail.busySlots.length === 0) {
    lines.push("Wide open — no existing appointments in this window.");
    return lines.join("\n");
  }

  lines.push("Busy times:");
  for (const slot of avail.busySlots) {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    const day = start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const startTime = start.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    const endTime = end.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    lines.push(`  ${day}: ${startTime} – ${endTime}`);
  }

  lines.push(
    "Propose times OUTSIDE of these busy blocks. Business hours are 8am-6pm."
  );

  return lines.join("\n");
}
