import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireUserForApi } from "@/lib/auth";
import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  listRecentDeliveries,
} from "@/lib/store";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

const VALID_EVENTS = [
  "contact.created",
  "contact.updated",
  "deal.created",
  "deal.updated",
  "deal.stage_changed",
  "email.received",
  "email.processed",
  "followup.created",
  "followup.sent",
  "invoice.created",
  "invoice.status_changed",
] as const;

const CreateSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(VALID_EVENTS)).default([]),
  secret: z.string().optional(),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  url: z.string().url().optional(),
  events: z.array(z.enum(VALID_EVENTS)).optional(),
  secret: z.string().optional(),
  enabled: z.boolean().optional(),
});

const DeleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  try {
    const user = await requireUserForApi();
    const endpoints = listWebhookEndpoints(user.id);
    return NextResponse.json({ endpoints });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }
}

export const POST = apiRoute({}, async (request, user) => {
  const payload = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const endpoint = createWebhookEndpoint(user.id, parsed.data);
  return NextResponse.json({ endpoint }, { status: 201 });
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
  const endpoint = updateWebhookEndpoint(user.id, id, rest);
  if (!endpoint) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ endpoint });
});

export const DELETE = apiRoute({}, async (request, user) => {
  const payload = await request.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const deleted = deleteWebhookEndpoint(user.id, parsed.data.id);
  return NextResponse.json({ deleted });
});
