import { NextResponse } from "next/server";
import { requireUserForApi, AuthError } from "@/lib/auth";
import { buildGmailAuthUrl, isGmailOAuthConfigured } from "@/lib/gmail";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = requireUserForApi();
    if (!isGmailOAuthConfigured()) {
      return NextResponse.json(
        { error: "not_configured", message: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
        { status: 400 }
      );
    }
    const url = buildGmailAuthUrl(user.id);
    return NextResponse.redirect(url);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.redirect(new URL("/login", process.env.APP_BASE_URL || "http://localhost:3000"));
    }
    throw err;
  }
}
