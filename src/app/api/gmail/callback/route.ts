import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateUserGmail } from "@/lib/store";
import { exchangeGmailCode, getGmailProfile } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const user = await getCurrentUser();
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
    const tokens = await exchangeGmailCode(code);
    const profile = await getGmailProfile(tokens.accessToken);

    updateUserGmail(user.id, {
      gmailAccessToken: tokens.accessToken,
      gmailRefreshToken: tokens.refreshToken,
      gmailConnected: true,
      gmailEmail: profile.email,
    });

    return NextResponse.redirect(
      new URL("/settings/email?connected=gmail", base)
    );
  } catch (err) {
    console.error("Gmail OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/settings/email?error=oauth_failed", base)
    );
  }
}
