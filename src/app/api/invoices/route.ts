import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireUserForApi } from "@/lib/auth";
import {
  listInvoices,
  createInvoice,
  updateInvoice,
  getInvoice,
} from "@/lib/store";
import type { InvoiceType, InvoiceStatus } from "@/lib/types";
import { apiRoute } from "@/lib/guard";
import { emitWebhookEvent } from "@/lib/webhooks";

export const runtime = "nodejs";

const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  total: z.number(),
});

const CreateSchema = z.object({
  type: z.enum(["quote", "invoice"]),
  contactId: z.string().min(1),
  dealId: z.string().optional(),
  lineItems: z.array(LineItemSchema).min(1),
  tax: z.number().optional(),
  notes: z.string().optional(),
  validUntil: z.string().optional(),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  status: z
    .enum(["draft", "sent", "accepted", "declined", "paid", "void"])
    .optional(),
  lineItems: z.array(LineItemSchema).optional(),
  tax: z.number().optional(),
  notes: z.string().optional(),
  validUntil: z.string().optional(),
  paidAt: z.string().optional(),
  sentAt: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const user = await requireUserForApi();
    const url = new URL(request.url);
    const type = url.searchParams.get("type") as InvoiceType | null;
    const status = url.searchParams.get("status") as InvoiceStatus | null;
    const invoices = listInvoices(user.id, {
      type: type || undefined,
      status: status || undefined,
    });
    return NextResponse.json({ invoices });
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

  const invoice = createInvoice(user.id, parsed.data);
  emitWebhookEvent(user.id, "invoice.created", { invoice });
  return NextResponse.json({ invoice }, { status: 201 });
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
  const before = getInvoice(user.id, id);
  const invoice = updateInvoice(user.id, id, rest);
  if (!invoice) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (before && before.status !== invoice.status) {
    emitWebhookEvent(user.id, "invoice.status_changed", { invoice, previousStatus: before.status });
  }
  return NextResponse.json({ invoice });
});
