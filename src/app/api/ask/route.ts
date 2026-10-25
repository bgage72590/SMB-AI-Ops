import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserById } from "@/lib/store";
import { askQuestion } from "@/lib/ask";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

const AskSchema = z.object({
  question: z.string().min(1).max(2000),
});

/**
 * POST /api/ask
 * Body: { question: string }
 *
 * Open-ended AI question answering with full CRM context.
 */
export const POST = apiRoute({ feature: "ask_box", rate: { bucket: "ask", max: 20, windowMs: 15 * 60_000 } }, async (request, user) => {
  const payload = await request.json().catch(() => null);
  const parsed = AskSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const fresh = getUserById(user.id);
  if (!fresh) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const result = await askQuestion(fresh, parsed.data.question);
  return NextResponse.json(result);
});
