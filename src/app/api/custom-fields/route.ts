import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireUserForApi } from "@/lib/auth";
import {
  getCustomFields,
  setCustomFields,
  getCustomFieldSchema,
  setCustomFieldSchema,
} from "@/lib/store";

export const runtime = "nodejs";

const UpdateSchema = z.object({
  entityType: z.enum(["contact", "deal"]),
  entityId: z.string().min(1),
  fields: z.record(z.string(), z.unknown()),
});

const SchemaUpdateSchema = z.object({
  entityType: z.enum(["contact", "deal"]),
  schema: z.array(
    z.object({
      key: z.string().min(1).max(64),
      label: z.string().min(1).max(100),
      type: z.enum(["text", "number", "date", "select"]),
      options: z.array(z.string()).optional(),
    })
  ),
});

/**
 * GET /api/custom-fields?entityType=contact&entityId=abc
 * Returns custom field values for a specific entity.
 *
 * GET /api/custom-fields?entityType=contact&schema=true
 * Returns the custom field schema for an entity type.
 */
export async function GET(request: Request) {
  let user;
  try {
    user = requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType") as
    | "contact"
    | "deal"
    | null;
  const entityId = url.searchParams.get("entityId");
  const wantSchema = url.searchParams.get("schema") === "true";

  if (!entityType || !["contact", "deal"].includes(entityType)) {
    return NextResponse.json(
      { error: "entityType must be contact or deal" },
      { status: 400 }
    );
  }

  if (wantSchema) {
    const schema = getCustomFieldSchema(user.id, entityType);
    return NextResponse.json({ schema });
  }

  if (!entityId) {
    return NextResponse.json(
      { error: "entityId required" },
      { status: 400 }
    );
  }

  const fields = getCustomFields(user.id, entityType, entityId);
  return NextResponse.json({ fields });
}

/**
 * POST /api/custom-fields
 * Body: { entityType, entityId, fields: Record<string, unknown> }
 * Updates custom field values for a specific entity.
 *
 * PUT /api/custom-fields
 * Body: { entityType, schema: Array<{ key, label, type, options? }> }
 * Updates the custom field schema for an entity type.
 */
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

  const payload = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  setCustomFields(
    user.id,
    parsed.data.entityType,
    parsed.data.entityId,
    parsed.data.fields
  );

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  let user;
  try {
    user = requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const payload = await request.json().catch(() => null);
  const parsed = SchemaUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  setCustomFieldSchema(user.id, parsed.data.entityType, parsed.data.schema);
  return NextResponse.json({ ok: true });
}
