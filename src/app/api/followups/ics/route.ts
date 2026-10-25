import { NextResponse } from "next/server";
import { getFollowUp } from "@/lib/store";
import { AuthError, requireUserForApi } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const followUp = getFollowUp(user.id, id);
  if (!followUp || !followUp.icsData) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return new Response(followUp.icsData, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${followUp.id}.ics"`,
    },
  });
}
