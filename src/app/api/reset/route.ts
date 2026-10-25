import { NextResponse } from "next/server";
import { resetStore } from "@/lib/store";
import { AuthError, requireUserForApi } from "@/lib/auth";

export const runtime = "nodejs";

// Dev helper: wipe the current user's workspace back to the seed state.
export async function POST() {
  try {
    const user = await requireUserForApi();
    const fresh = resetStore(user.id);
    return NextResponse.json({ ok: true, snapshot: fresh });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
