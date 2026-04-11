import { NextResponse } from "next/server";
import { runWeeklyDigest } from "@/lib/digest";
import { verifyCronSecret } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Digests involve an LLM call per user and an outbound email per user,
// so allow up to 5 minutes on platforms with function timeouts.
export const maxDuration = 300;

/**
 * Scheduled entry point for the weekly AI digest. Point your scheduler
 * of choice at this URL with `Authorization: Bearer $CRON_SECRET` and
 * run it Monday morning.
 *
 * Vercel cron example (vercel.json):
 * {
 *   "crons": [
 *     { "path": "/api/jobs/weekly-digest", "schedule": "0 13 * * 1" }
 *   ]
 * }
 * (13:00 UTC = 8am US Eastern.)
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
