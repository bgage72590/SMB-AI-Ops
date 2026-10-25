import { NextResponse } from "next/server";
import { generatePipelineReport } from "@/lib/reports";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

/**
 * GET /api/reports
 * Returns the full pipeline report for the authenticated user.
 */
export const GET = apiRoute({ feature: "pipeline_reports" }, async (_request, user) => {
  const report = generatePipelineReport(user.id);
  return NextResponse.json(report);
});
