import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyWidgetToken, isWidgetConfigured } from "@/lib/widget";
import { createEmail, getUserById } from "@/lib/store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ChatSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  message: z.string().min(1).max(5000),
  phone: z.string().max(30).optional(),
});

/**
 * POST /api/widget/chat
 * Body: { token, name, email, message, phone? }
 *
 * Receives messages from the embeddable website chat widget and drops
 * them into the owner's inbox as a new lead email. CORS-enabled so
 * the widget can be embedded on any domain.
 */
export async function POST(request: Request) {
  if (!isWidgetConfigured()) {
    return NextResponse.json(
      { error: "widget_not_configured" },
      { status: 503 }
    );
  }

  const ip = getClientIp(request);
  const limit = checkRateLimit(`widget:${ip}`, 10, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429 }
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = ChatSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed" },
      { status: 400 }
    );
  }

  const verified = verifyWidgetToken(parsed.data.token);
  if (!verified.valid) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const owner = getUserById(verified.userId);
  if (!owner) {
    return NextResponse.json({ error: "owner_not_found" }, { status: 404 });
  }

  const body = parsed.data.phone
    ? `${parsed.data.message}\n\nPhone: ${parsed.data.phone}`
    : parsed.data.message;

  createEmail(owner.id, {
    from: parsed.data.email,
    fromName: parsed.data.name,
    to: owner.email,
    subject: `Website inquiry from ${parsed.data.name}`,
    body,
  });

  const response = NextResponse.json({ ok: true });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}
