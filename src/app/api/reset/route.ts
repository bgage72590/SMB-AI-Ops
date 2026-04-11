import { NextResponse } from "next/server";
import { resetStore } from "@/lib/store";

export const runtime = "nodejs";

// Dev helper: wipe the local JSON store back to the seed state.
export async function POST() {
  const fresh = resetStore();
  return NextResponse.json({ ok: true, snapshot: fresh });
}
