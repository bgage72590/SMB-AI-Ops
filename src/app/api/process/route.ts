import { NextResponse } from "next/server";
import { processAllUnprocessed, processEmail } from "@/lib/pipeline";
import { getEmail } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    const email = getEmail(emailId);
    if (!email) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const result = await processEmail(email);
    return NextResponse.json({ processed: 1, results: [result] });
  }

  const results = await processAllUnprocessed();
  return NextResponse.json({ processed: results.length, results });
}
