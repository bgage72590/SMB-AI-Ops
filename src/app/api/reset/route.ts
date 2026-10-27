import { NextResponse } from "next/server";
import { resetStore } from "@/lib/store";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

// Dev helper: wipe the current user's workspace back to the seed state.
export const POST = apiRoute({ rate: { bucket: "reset", max: 3, windowMs: 15 * 60_000 } }, async (_request, user) => {
  const fresh = resetStore(user.id);
  return NextResponse.json({ ok: true, snapshot: fresh });
});
