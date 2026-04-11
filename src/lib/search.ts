import { listContacts, listDeals, listEmails, listFollowUps } from "./store";

// Substring search across a user's workspace. Runs synchronously over
// rows pulled from SQLite — perfectly fine for the kind of volume an SMB
// puts through this tool. When we add FTS5 later this module is the one
// place that needs to change.

export type SearchResultKind = "contact" | "deal" | "email" | "followup";

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  score: number;
}

const MAX_RESULTS_PER_KIND = 6;

/**
 * Score a row against a lowercased query. 3 for title match, 2 for
 * subtitle match, 1 for fallback "contains". Returns 0 for no match.
 */
function score(query: string, title: string, subtitle?: string): number {
  const t = title.toLowerCase();
  const s = (subtitle || "").toLowerCase();
  if (t.startsWith(query)) return 4;
  if (t.includes(query)) return 3;
  if (s.includes(query)) return 2;
  return 0;
}

export function searchWorkspace(userId: string, rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];

  const results: SearchResult[] = [];

  for (const c of listContacts(userId)) {
    const subtitle = [c.company, c.email].filter(Boolean).join(" · ");
    const s = score(query, c.name, subtitle);
    if (s > 0) {
      results.push({
        kind: "contact",
        id: c.id,
        title: c.name,
        subtitle: subtitle || undefined,
        href: `/contacts/${c.id}`,
        score: s,
      });
    }
  }

  for (const d of listDeals(userId)) {
    const s = score(query, d.title, d.stage);
    if (s > 0) {
      results.push({
        kind: "deal",
        id: d.id,
        title: d.title,
        subtitle: `$${d.amount.toLocaleString()} · ${d.stage}`,
        href: `/deals/${d.id}`,
        score: s,
      });
    }
  }

  for (const e of listEmails(userId)) {
    const s = score(query, e.subject, `${e.fromName || ""} ${e.from}`);
    if (s > 0) {
      results.push({
        kind: "email",
        id: e.id,
        title: e.subject || "(no subject)",
        subtitle: e.fromName ? `${e.fromName} · ${e.from}` : e.from,
        href: `/inbox`,
        score: s,
      });
    }
  }

  for (const f of listFollowUps(userId)) {
    const s = score(query, f.subject, f.status);
    if (s > 0) {
      results.push({
        kind: "followup",
        id: f.id,
        title: f.subject,
        subtitle: f.status,
        href: `/followups`,
        score: s,
      });
    }
  }

  // Sort highest score first, then trim per-kind so a single kind can't
  // drown the palette.
  const byKind: Record<SearchResultKind, SearchResult[]> = {
    contact: [],
    deal: [],
    email: [],
    followup: [],
  };
  for (const r of results.sort((a, b) => b.score - a.score)) {
    const bucket = byKind[r.kind];
    if (bucket.length < MAX_RESULTS_PER_KIND) bucket.push(r);
  }

  return [
    ...byKind.contact,
    ...byKind.deal,
    ...byKind.email,
    ...byKind.followup,
  ];
}
