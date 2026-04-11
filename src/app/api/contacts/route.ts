import { NextResponse } from "next/server";
import { z } from "zod";
import { listContacts, upsertContact } from "@/lib/store";

export const runtime = "nodejs";

const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({ contacts: listContacts() });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = ContactSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const contact = upsertContact(parsed.data);
  return NextResponse.json({ contact }, { status: 201 });
}
