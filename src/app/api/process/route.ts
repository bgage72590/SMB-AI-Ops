import { NextResponse } from "next/server";
import { processAllUnprocessed, processEmail } from "@/lib/pipeline";
import { getEmail } from "@/lib/store";
import { enqueueUnprocessedEmails } from "@/lib/jobs";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { trialGuardResponse } from "@/lib/trialGuard";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let user;
  try {
    user = requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const blocked = trialGuardResponse(user);
  if (blocked) return blocked;

  let emailId: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && typeof body.emailId === "string") {
      emailId = body.emailId;
    }
  } catch {
    // Empty body is fine — means "process everything unprocessed".
  }

  if (emailId) {
    const email = getEmail(user.id, emailId);
    if (!email) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const result = await processEmail(user.id, email);
    return NextResponse.json({ processed: 1, results: [result] });
  }

  // Bulk "process everything unprocessed". On serverless platforms with
  // short function timeouts, this can blow past 60s if the inbox is
  // large — so when JOB_QUEUE_MODE=async we hand the batch off to the
  // background queue and return immediately. Otherwise we keep the old
  // synchronous behavior for local dev ergonomics.
  if (process.env.JOB_QUEUE_MODE === "async") {
    const enqueued = enqueueUnprocessedEmails(user.id);
    return NextResponse.json({ enqueued, mode: "async" });
  }

  const results = await processAllUnprocessed(user.id);
  return NextResponse.json({ processed: results.length, results });
}
