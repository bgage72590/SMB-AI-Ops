import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addBlocklistEntry,
  listBlocklistEntries,
  logAudit,
  removeBlocklistEntry,
} from "@/lib/store";
import { AuthError, requireUserForApi } from "@/lib/auth";

export const runtime = "nodejs";

const AddSchema = z.object({
  pattern: z.string().min(1).max(254),
  reason: z.string().max(200).optional(),
});

const RemoveSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireUserForApi();
    return NextResponse.json({ entries: listBlocklistEntries(user.id) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const payload = await request.json().catch(() => null);
  const parsed = AddSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const entry = addBlocklistEntry(user.id, parsed.data.pattern, parsed.data.reason);
  logAudit(user.id, "added", "blocklist", entry.id, `Pattern: ${entry.pattern}`);
  return NextResponse.json({ entry }, { status: 201 });
}

export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const payload = await request.json().catch(() => null);
  const parsed = RemoveSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const removed = removeBlocklistEntry(user.id, parsed.data.id);
  if (removed) {
    logAudit(user.id, "removed", "blocklist", parsed.data.id);
  }
  return NextResponse.json({ removed });
}
