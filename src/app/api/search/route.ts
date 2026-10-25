import { NextResponse } from "next/server";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { searchWorkspace } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/search?q=... — returns a flat list of workspace hits scoped to
// the signed-in user. The results are used by the Cmd-K palette on the
// client. No caching — search results are user-specific and cheap enough
// to recompute on every keystroke.
export async function GET(request: Request) {
  try {
    const user = await requireUserForApi();
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const results = searchWorkspace(user.id, q);
    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}
