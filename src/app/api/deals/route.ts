import { NextResponse } from "next/server";
import { z } from "zod";
import { createDeal, listDeals, updateDeal } from "@/lib/store";
import { AuthError, requireUserForApi } from "@/lib/auth";

export const runtime = "nodejs";

const STAGES = [
  "inquiry",
  "quoted",
  "scheduled",
  "in_progress",
  "completed",
  "lost",
] as const;

const CreateSchema = z.object({
  title: z.string().min(1),
  contactId: z.string().min(1),
  stage: z.enum(STAGES).optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  costMaterials: z.number().nonnegative().optional(),
  costLabor: z.number().nonnegative().optional(),
  nextStep: z.string().optional(),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  stage: z.enum(STAGES).optional(),
  amount: z.number().nonnegative().optional(),
  costMaterials: z.number().nonnegative().optional(),
  costLabor: z.number().nonnegative().optional(),
  nextStep: z.string().optional(),
  title: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUserForApi();
    return NextResponse.json({ deals: listDeals(user.id) });
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
  const deal = createDeal(user.id, parsed.data);
  return NextResponse.json({ deal }, { status: 201 });
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
  const deal = updateDeal(user.id, id, rest);
  if (!deal) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ deal });
}
