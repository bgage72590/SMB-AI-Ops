import { NextResponse } from "next/server";
import { enqueueDecayNudges } from "@/lib/jobs";
import { verifyCronSecret } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily cron that scans for stale deals (no activity in 5+ days) and
 * enqueues follow-up nudge jobs. Run once a day.
 *
 * Vercel cron example (vercel.json):
 * {
 *   "crons": [
 *     { "path": "/api/jobs/deal-decay", "schedule": "0 14 * * *" }
 *   ]
 * }
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const nudgesEnqueued = enqueueDecayNudges();
  return NextResponse.json({ nudgesEnqueued });
}

export async function GET(request: Request) {
  return POST(request);
}
