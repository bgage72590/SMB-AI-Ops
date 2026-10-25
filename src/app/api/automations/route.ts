import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
} from "@/lib/store";
import { AuthError, requireUserForApi } from "@/lib/auth";

export const runtime = "nodejs";

const TRIGGERS = [
  "no_reply",
  "stale_deal",
  "email_received",
  "deal_stage_change",
] as const;

const ACTIONS = [
  "draft_followup",
  "send_notification",
  "update_stage",
  "add_note",
] as const;

const CreateSchema = z.object({
  name: z.string().min(1),
  trigger: z.enum(TRIGGERS),
  conditions: z.record(z.unknown()).optional(),
  action: z.enum(ACTIONS),
  actionConfig: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  trigger: z.enum(TRIGGERS).optional(),
  conditions: z.record(z.unknown()).optional(),
  action: z.enum(ACTIONS).optional(),
  actionConfig: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

const DeleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireUserForApi();
    return NextResponse.json({ automations: listAutomations(user.id) });
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
  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const automation = createAutomation(user.id, parsed.data);
  return NextResponse.json({ automation }, { status: 201 });
}

export async function PATCH(request: Request) {
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
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id, ...rest } = parsed.data;
  const automation = updateAutomation(user.id, id, rest);
  if (!automation) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ automation });
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
  const parsed = DeleteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const deleted = deleteAutomation(user.id, parsed.data.id);
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
