import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { findUserBySlackChannel, logAudit, setUserSlack } from "@/lib/store";
import { exchangeSlackCode, SLACK_OAUTH_STATE_COOKIE } from "@/lib/slack";

export const runtime = "nodejs";

function stateMatches(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const done = (query: string) => {
    const response = NextResponse.redirect(new URL(`/settings/slack?${query}`, base));
    response.cookies.delete({ name: SLACK_OAUTH_STATE_COOKIE, path: "/api/slack/callback" });
    return response;
  };

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", base));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const expectedState = (await cookies()).get(SLACK_OAUTH_STATE_COOKIE)?.value;
  if (!stateMatches(expectedState, url.searchParams.get("state"))) {
    return done("error=oauth_state");
  }
  if (url.searchParams.get("error") || !code) {
    return done("error=oauth_denied");
  }

  try {
    const install = await exchangeSlackCode(code);
    const holder = findUserBySlackChannel(install.teamId, install.channelId);
    if (holder && holder.id !== user.id) {
      return done("error=channel_taken");
    }
    setUserSlack(user.id, install);
    logAudit(user.id, "connected", "slack", undefined, `Slack #${install.channelName}`);
    return done("connected=1");
  } catch (err) {
    console.error("Slack OAuth callback error:", err);
    return done("error=oauth_failed");
  }
}
