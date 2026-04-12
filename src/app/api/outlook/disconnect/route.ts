import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { updateUserOutlook } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = requireUserForApi();
    updateUserOutlook(user.id, {
      outlookAccessToken: null,
      outlookRefreshToken: null,
      outlookConnected: false,
      outlookEmail: null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
