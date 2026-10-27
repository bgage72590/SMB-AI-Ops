import { NextResponse } from "next/server";
import { runWeeklyDigest } from "@/lib/digest";
import { verifyCronSecret } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Digests involve an LLM call per user and an outbound email per user,
// so allow up to 5 minutes on platforms with function timeouts.
export const maxDuration = 300;

/**
 * Entry point for the weekly AI digest (Mondays, 13:00 UTC).
 *
 * Runs automatically from the in-process scheduler (src/lib/scheduler.ts).
 * This route is a manual trigger: `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runWeeklyDigest();
  return NextResponse.json(result);
}

// GET is allowed so you can hit it from a browser during dev to smoke-test.
export async function GET(request: Request) {
  return POST(request);
}
