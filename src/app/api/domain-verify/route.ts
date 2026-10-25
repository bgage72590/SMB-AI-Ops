import { NextResponse } from "next/server";
import { z } from "zod";
import { checkDomainRecords } from "@/lib/domain-verify";
import { apiRoute } from "@/lib/guard";

export const runtime = "nodejs";

const CheckSchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Invalid domain format"),
});

export const POST = apiRoute({ rate: { bucket: "dns", max: 20, windowMs: 10 * 60_000 } }, async (request) => {
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
});
