import { NextResponse } from "next/server";
import { z } from "zod";
import { createDeal, listDeals, updateDeal } from "@/lib/store";

export const runtime = "nodejs";

const CreateSchema = z.object({
  title: z.string().min(1),
  contactId: z.string().min(1),
  stage: z
    .enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"])
    .optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  nextStep: z.string().optional(),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  stage: z
    .enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"])
    .optional(),
  amount: z.number().nonnegative().optional(),
  nextStep: z.string().optional(),
  title: z.string().optional(),
});

export async function GET() {
  return NextResponse.json({ deals: listDeals() });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const deal = createDeal(parsed.data);
  return NextResponse.json({ deal }, { status: 201 });
}

export async function PATCH(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { id, ...rest } = parsed.data;
  const deal = updateDeal(id, rest);
  if (!deal) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ deal });
}
