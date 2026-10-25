import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
import { logAudit, updateUserCalendar } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    throw err;
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    const dest = new URL("/settings/calendar", request.url);
    dest.searchParams.set("error", error || "no_code");
    return NextResponse.redirect(dest);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    updateUserCalendar(user.id, {
      googleAccessToken: tokens.accessToken,
      googleRefreshToken: tokens.refreshToken,
      googleCalendarEnabled: true,
    });
    logAudit(user.id, "connected", "calendar", undefined, "Google Calendar connected");
    return NextResponse.redirect(new URL("/settings/calendar?connected=1", request.url));
  } catch (err) {
    console.error("Google Calendar OAuth callback failed:", err);
    const dest = new URL("/settings/calendar", request.url);
    dest.searchParams.set("error", "token_exchange_failed");
    return NextResponse.redirect(dest);
  }
}
