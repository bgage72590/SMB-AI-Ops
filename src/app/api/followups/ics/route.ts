import { NextResponse } from "next/server";
import { getFollowUp } from "@/lib/store";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

export const GET = apiRoute({ feature: "calendar_ics" }, async (request, user) => {
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
});
