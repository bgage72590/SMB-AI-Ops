import { NextResponse } from "next/server";
import { requireUserForApi, AuthError } from "@/lib/auth";
import { buildOutlookAuthUrl, isOutlookOAuthConfigured } from "@/lib/outlook";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUserForApi();
    if (!isOutlookOAuthConfigured()) {
      return NextResponse.json(
        { error: "not_configured", message: "Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET." },
        { status: 400 }
      );
    }
    const url = buildOutlookAuthUrl(user.id);
    return NextResponse.redirect(url);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.redirect(new URL("/login", process.env.APP_BASE_URL || "http://localhost:3000"));
    }
    throw err;
  }
}
