import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthError, requireUserForApi } from "@/lib/auth";
import {
  getContact,
  getEnrichmentCache,
  setEnrichmentCache,
  updateContact,
} from "@/lib/store";
import {
  enrichContact,
  isEnrichmentConfigured,
} from "@/lib/enrichment";

export const runtime = "nodejs";

const EnrichSchema = z.object({
  contactId: z.string().min(1),
});

/**
 * POST /api/enrichment
 * Body: { contactId: string }
 *
 * Enriches a contact by looking up their email against the configured
 * enrichment provider. Results are cached by email so repeat lookups
 * for the same person don't cost money.
 */
export async function POST(request: Request) {
  if (!isEnrichmentConfigured()) {
    return NextResponse.json(
      { error: "enrichment_not_configured" },
      { status: 503 }
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
  const parsed = EnrichSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed" },
      { status: 400 }
    );
  }

  const contact = getContact(user.id, parsed.data.contactId);
  if (!contact) {
    return NextResponse.json(
      { error: "contact_not_found" },
      { status: 404 }
    );
  }

  const cached = getEnrichmentCache(contact.email);
  if (cached) {
    return NextResponse.json({ enrichment: cached, source: "cache" });
  }

  const result = await enrichContact(contact.email);
  if (!result) {
    return NextResponse.json(
      { error: "enrichment_failed" },
      { status: 502 }
    );
  }

  setEnrichmentCache(contact.email, result as unknown as Record<string, unknown>);

  if (result.company && !contact.company) {
    updateContact(user.id, contact.id, { company: result.company });
  }
  if (result.phone && !contact.phone) {
    updateContact(user.id, contact.id, { phone: result.phone });
  }

  return NextResponse.json({ enrichment: result, source: "live" });
}
