import { NextResponse } from "next/server";
import { logAudit, updateUserCalendar } from "@/lib/store";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

export const POST = apiRoute({}, async (_request, user) => {
  updateUserCalendar(user.id, {
    googleAccessToken: null,
    googleRefreshToken: null,
    googleCalendarEnabled: false,
  });
  logAudit(user.id, "disconnected", "calendar", undefined, "Google Calendar disconnected");
  return NextResponse.json({ ok: true });
});
