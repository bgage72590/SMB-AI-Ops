import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateUserOutlook } from "@/lib/store";
import { exchangeOutlookCode, getOutlookProfile } from "@/lib/outlook";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const user = getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", base));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/settings/email?error=oauth_denied", base)
    );
  }

  try {
    const tokens = await exchangeOutlookCode(code);
    const profile = await getOutlookProfile(tokens.accessToken);

    updateUserOutlook(user.id, {
      outlookAccessToken: tokens.accessToken,
      outlookRefreshToken: tokens.refreshToken,
      outlookConnected: true,
      outlookEmail: profile.email,
    });

    return NextResponse.redirect(
      new URL("/settings/email?connected=outlook", base)
    );
  } catch (err) {
    console.error("Outlook OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/settings/email?error=oauth_failed", base)
    );
  }
}
