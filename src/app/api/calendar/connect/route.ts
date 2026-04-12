import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import {
  buildAuthUrl,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar";

export const runtime = "nodejs";

export async function GET() {
  try {
    requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      {
        error: "google_not_configured",
        message:
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable calendar.",
      },
      { status: 412 }
    );
  }

  const url = buildAuthUrl();
  return NextResponse.redirect(url);
}
