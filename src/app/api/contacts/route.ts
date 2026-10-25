import { NextResponse } from "next/server";
import { z } from "zod";
import { listContacts, upsertContact, updateContact } from "@/lib/store";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUserForApi();
    return NextResponse.json({ contacts: listContacts(user.id) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}

export const POST = apiRoute({}, async (request, user) => {
  const payload = await request.json().catch(() => null);
  const parsed = ContactSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const contact = upsertContact(user.id, parsed.data);
  return NextResponse.json({ contact }, { status: 201 });
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const PATCH = apiRoute({}, async (request, user) => {
  const payload = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id, ...rest } = parsed.data;
  const contact = updateContact(user.id, id, rest);
  if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ contact });
});
