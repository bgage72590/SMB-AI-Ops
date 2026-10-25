import { NextResponse } from "next/server";
import { z } from "zod";
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
import { apiRoute, chargePaid } from "@/lib/guard";

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
export const POST = apiRoute({ feature: "lead_enrichment", rate: { bucket: "enrichment", max: 30, windowMs: 10 * 60_000 } }, async (request, user) => {
  if (!isEnrichmentConfigured()) {
    return NextResponse.json(
      { error: "enrichment_not_configured" },
      { status: 503 }
    );
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

  chargePaid(user, "enrichment");
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
});
