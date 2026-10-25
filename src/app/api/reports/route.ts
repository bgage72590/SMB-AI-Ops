import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { generatePipelineReport } from "@/lib/reports";

export const runtime = "nodejs";

/**
 * GET /api/reports
 * Returns the full pipeline report for the authenticated user.
 */
export async function GET() {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const report = generatePipelineReport(user.id);
  return NextResponse.json(report);
}
