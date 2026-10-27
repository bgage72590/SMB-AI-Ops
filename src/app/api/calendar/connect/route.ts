import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/guard";
import {
  buildAuthUrl,
  isGoogleCalendarConfigured,
} from "@/lib/google-calendar";

export const runtime = "nodejs";

export const GET = apiRoute({ feature: "calendar_sync" }, async () => {
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
});
