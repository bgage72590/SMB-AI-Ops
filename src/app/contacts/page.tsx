import Link from "next/link";
import { Suspense } from "react";
import { Pagination, paginate } from "@/components/Pagination";
import { ContactSearch } from "@/components/ContactSearch";
import { StageBadge } from "@/components/Badge";
import { listContacts, listDeals } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clients | SMB AI Ops",
  description: "Manage your client book.",
};

export const dynamic = "force-dynamic";

const PER_PAGE = 25;

export default function ClientsPage({
  searchParams,
}: {
  searchParams?: { page?: string; q?: string };
}) {
  const user = requireUser();
  const allContacts = listContacts(user.id);
  const deals = listDeals(user.id);

  const q = searchParams?.q?.toLowerCase().trim();
  const contacts = q
    ? allContacts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.company && c.company.toLowerCase().includes(q))
      )
    : allContacts;

  const withOpenJob = allContacts.filter((c) =>
    deals.some(
      (d) =>
        d.contactId === c.id && d.stage !== "completed" && d.stage !== "lost"
    )
  ).length;

  const page = parseInt(searchParams?.page || "1", 10);
  const { items: pageContacts, currentPage, totalPages } = paginate(contacts, page, PER_PAGE);

  const searchParamsForPagination: Record<string, string> = {};
  if (q) searchParamsForPagination.q = searchParams!.q!;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Clients</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            {allContacts.length} in your book &middot; {withOpenJob} with an open job
          </p>
        </div>
        {allContacts.length > 0 && (
          <a
            href="/api/export?type=contacts"
            download
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg border border-border bg-surface text-fg-muted hover:bg-surface-2 transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </a>
        )}
      </div>

      {/* Search */}
      <Suspense>
        <ContactSearch />
      </Suspense>

      {q && (
        <p className="text-xs text-fg-subtle">
          {contacts.length} result{contacts.length === 1 ? "" : "s"} for &ldquo;{searchParams!.q}&rdquo;
        </p>
      )}

      {/* Empty state */}
      {contacts.length === 0 && !q && (
        <div className="rounded-xl border border-dashed border-border bg-surface py-14 text-center">
          <div className="text-sm font-medium text-fg">No clients yet</div>
          <p className="text-xs text-fg-subtle mt-1 max-w-xs mx-auto">
            Process your inbox to pull the first few in &mdash; any real inbound email becomes a client record.
          </p>
        </div>
      )}

      {contacts.length === 0 && q && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-fg-subtle">
          No clients match your search.
        </div>
      )}

      {/* Desktop table */}
      {contacts.length > 0 && (
        <div className="hidden md:block rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Open job</th>
                <th className="text-right px-4 py-2.5">Last touch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageContacts.map((contact) => {
                const openDeal = deals.find(
                  (d) =>
                    d.contactId === contact.id &&
                    d.stage !== "completed" &&
                    d.stage !== "lost"
                );
                return (
                  <tr
                    key={contact.id}
                    className="hover:bg-surface-2/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-medium text-fg hover:text-accent transition-colors"
                      >
                        {contact.name}
                      </Link>
                      {contact.company && (
                        <div className="text-xs text-fg-subtle mt-0.5">
                          {contact.company}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-fg-muted tabular-nums">
                      {contact.phone || <span className="text-fg-subtle">&mdash;</span>}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {contact.email}
                    </td>
                    <td className="px-4 py-3">
                      {openDeal ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <StageBadge stage={openDeal.stage} />
                          <span className="text-fg text-xs truncate">
                            {openDeal.title}
                          </span>
                          <span className="text-fg-subtle text-xs tabular-nums whitespace-nowrap">
                            {formatCurrency(openDeal.amount, openDeal.currency)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-fg-subtle">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-fg-subtle text-xs whitespace-nowrap">
                      {formatRelative(contact.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile card layout */}
      {contacts.length > 0 && (
        <div className="md:hidden space-y-2">
          {pageContacts.map((contact) => {
            const openDeal = deals.find(
              (d) =>
                d.contactId === contact.id &&
                d.stage !== "completed" &&
                d.stage !== "lost"
            );
            return (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="block rounded-lg border border-border bg-surface p-3 hover:border-accent/40 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-fg">
                      {contact.name}
                    </div>
                    {contact.company && (
                      <div className="text-xs text-fg-subtle">{contact.company}</div>
                    )}
                  </div>
                  <span className="text-[11px] text-fg-subtle whitespace-nowrap">
                    {formatRelative(contact.updatedAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-fg-muted mt-1">
                  <span>{contact.email}</span>
                  {contact.phone && <span>{contact.phone}</span>}
                </div>
                {openDeal && (
                  <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-border">
                    <StageBadge stage={openDeal.stage} />
                    <span className="text-fg truncate">{openDeal.title}</span>
                    <span className="text-fg-subtle tabular-nums">
                      {formatCurrency(openDeal.amount, openDeal.currency)}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {contacts.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/contacts"
          searchParams={searchParamsForPagination}
        />
      )}
    </div>
  );
}
