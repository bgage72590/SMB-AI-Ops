import { NextResponse } from "next/server";
import { processAllUnprocessed, processEmail } from "@/lib/pipeline";
import { getEmail } from "@/lib/store";
import { AuthError, requireUserForApi } from "@/lib/auth";

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

  const results = await processAllUnprocessed(user.id);
  return NextResponse.json({ processed: results.length, results });
}
