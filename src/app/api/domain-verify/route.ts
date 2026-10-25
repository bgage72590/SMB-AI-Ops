import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireUserForApi } from "@/lib/auth";
import { checkDomainRecords } from "@/lib/domain-verify";

export const runtime = "nodejs";

const CheckSchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Invalid domain format"),
});

export async function POST(request: Request) {
  try {
    await requireUserForApi();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  const payload = await request.json().catch(() => null);
  const parsed = CheckSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await checkDomainRecords(parsed.data.domain);
  return NextResponse.json(result);
}
