import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// Website chat widget — generates embed tokens and validates inbound
// messages from the embeddable JS snippet on the SMB's website.
//
// Set WIDGET_SECRET to enable. This secret signs the widget token so
// we can verify which user's inbox receives the chat messages.

export function isWidgetConfigured(): boolean {
  return Boolean(process.env.WIDGET_SECRET);
}

export interface WidgetToken {
  userId: string;
  token: string;
  createdAt: string;
}

export function generateWidgetToken(userId: string): WidgetToken {
  const secret = process.env.WIDGET_SECRET;
  if (!secret) throw new Error("WIDGET_SECRET not configured");

  const payload = `${userId}:${Date.now()}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  const token = Buffer.from(`${payload}:${sig}`).toString("base64url");

  return {
    userId,
    token,
    createdAt: new Date().toISOString(),
  };
}

export function verifyWidgetToken(
  token: string
): { valid: true; userId: string } | { valid: false } {
  const secret = process.env.WIDGET_SECRET;
  if (!secret) return { valid: false };

  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return { valid: false };

    const [userId, timestamp, sig] = parts;
    const payload = `${userId}:${timestamp}`;
    const expected = createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const valid = timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expected)
    );

    return valid ? { valid: true, userId } : { valid: false };
  } catch {
    return { valid: false };
  }
}

export function generateVisitorId(): string {
  return randomUUID();
}
