import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { getUserById } from "@/lib/store";
import { askQuestion } from "@/lib/ask";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(`ask:${ip}`, 20, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterMs: limit.retryAfterMs },
      { status: 429 }
    );
  }

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
}
