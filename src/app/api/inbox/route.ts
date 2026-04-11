import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmail, listEmails } from "@/lib/store";
import { processEmail } from "@/lib/pipeline";

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
  return NextResponse.json({ emails: listEmails() });
}

export async function POST(request: Request) {
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

  const email = createEmail(parsed.data);
  if (parsed.data.autoProcess) {
    const result = await processEmail(email);
    return NextResponse.json({ email, result }, { status: 201 });
  }
  return NextResponse.json({ email }, { status: 201 });
}
