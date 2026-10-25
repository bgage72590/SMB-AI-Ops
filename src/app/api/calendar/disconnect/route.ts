import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { logAudit, updateUserCalendar } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  updateUserCalendar(user.id, {
    googleAccessToken: null,
    googleRefreshToken: null,
    googleCalendarEnabled: false,
  });
  logAudit(user.id, "disconnected", "calendar", undefined, "Google Calendar disconnected");
  return NextResponse.json({ ok: true });
}
