import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserForApi, AuthError } from "@/lib/auth";
import { GuardError, requireFeature } from "@/lib/guard";
import {
  buildSlackInstallUrl,
  isSlackAppConfigured,
  SLACK_OAUTH_STATE_COOKIE,
} from "@/lib/slack";

export const runtime = "nodejs";

// Start "Add to Slack". The random state is pinned to this browser in a
// short-lived cookie and checked on the way back, so nobody can trick a
// signed-in user into finishing an install the attacker started.
export async function GET() {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  try {
    requireFeature(await requireUserForApi(), "slack_integration");
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.redirect(new URL("/login", base));
    }
    if (err instanceof GuardError) {
      return NextResponse.redirect(new URL("/settings/slack?error=plan_required", base));
    }
    throw err;
  }
  if (!isSlackAppConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_SIGNING_SECRET.",
      },
      { status: 400 }
    );
  }

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(buildSlackInstallUrl(state));
  response.cookies.set({
    name: SLACK_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    sameSite: "lax",
    path: "/api/slack/callback",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
  });
  return response;
}
