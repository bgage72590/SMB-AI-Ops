import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmail, listEmails } from "@/lib/store";
import { processEmail } from "@/lib/pipeline";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

const IngestSchema = z.object({
  from: z.string().email(),
  fromName: z.string().optional(),
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  receivedAt: z.string().optional(),
  autoProcess: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    const user = await requireUserForApi();
    return NextResponse.json({ emails: listEmails(user.id) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}

export const POST = apiRoute({ rate: { bucket: "ingest", max: 60, windowMs: 60_000 } }, async (request, user) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = IngestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = createEmail(user.id, parsed.data);
  if (parsed.data.autoProcess) {
    const result = await processEmail(user.id, email);
    return NextResponse.json({ email, result }, { status: 201 });
  }
  return NextResponse.json({ email }, { status: 201 });
});
