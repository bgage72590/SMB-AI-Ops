// Lead enrichment — look up new contacts via an external data provider
// (Clearbit, Apollo, People Data Labs). We call a single configurable
// endpoint, cache results by email, and surface them on the contact card.
//
// Set ENRICHMENT_API_URL + ENRICHMENT_API_KEY to enable. The endpoint
// should accept GET ?email=<email> and return JSON with optional fields:
//   { company, title, phone, linkedin, location, industry, employees, revenue }
//
// A generic shape means you can point it at any enrichment proxy or
// serverless function without changing this module.

export interface EnrichmentResult {
  company?: string;
  title?: string;
  phone?: string;
  linkedin?: string;
  location?: string;
  industry?: string;
  employees?: string;
  revenue?: string;
  enrichedAt: string;
}

export function isEnrichmentConfigured(): boolean {
  return Boolean(
    process.env.ENRICHMENT_API_URL && process.env.ENRICHMENT_API_KEY
  );
}

export async function enrichContact(
  email: string
): Promise<EnrichmentResult | null> {
  const apiUrl = process.env.ENRICHMENT_API_URL;
  const apiKey = process.env.ENRICHMENT_API_KEY;
  if (!apiUrl || !apiKey) return null;

  const url = new URL(apiUrl);
  url.searchParams.set("email", email);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    console.warn(
      `[enrichment] lookup failed for ${email}: ${res.status} ${res.statusText}`
    );
    return null;
  }

  const data = await res.json();

  return {
    company: data.company || undefined,
    title: data.title || undefined,
    phone: data.phone || undefined,
    linkedin: data.linkedin || undefined,
    location: data.location || undefined,
    industry: data.industry || undefined,
    employees: data.employees?.toString() || undefined,
    revenue: data.revenue?.toString() || undefined,
    enrichedAt: new Date().toISOString(),
  };
}
