import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { updateUserGmail } from "@/lib/store";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await requireUserForApi();
    updateUserGmail(user.id, {
      gmailAccessToken: null,
      gmailRefreshToken: null,
      gmailConnected: false,
      gmailEmail: null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
