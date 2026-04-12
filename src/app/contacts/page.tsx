import Link from "next/link";
import { Suspense } from "react";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { Pagination, paginate } from "@/components/Pagination";
import { ContactSearch } from "@/components/ContactSearch";
import { StageBadge } from "@/components/Badge";
import { listContacts, listDeals } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";

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
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description={`${allContacts.length} in your book \u00b7 ${withOpenJob} with an open job`}
      />

      <Suspense>
        <ContactSearch />
      </Suspense>

      {q && (
        <p className="text-xs text-fg-subtle">
          {contacts.length} result{contacts.length === 1 ? "" : "s"} for &ldquo;{searchParams!.q}&rdquo;
        </p>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          title="All clients"
          subtitle="Sorted by most recent activity"
        />
        {contacts.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon="\ud83d\udc65"
              title="No clients yet"
              description="Process your inbox to pull the first few in \u2014 any real inbound email becomes a client record."
            />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-fg-subtle text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold">Name</th>
                    <th className="text-left px-4 py-2 font-semibold">Phone</th>
                    <th className="text-left px-4 py-2 font-semibold">Email</th>
                    <th className="text-left px-4 py-2 font-semibold">
                      Open job
                    </th>
                    <th className="text-left px-4 py-2 font-semibold">
                      Last touch
                    </th>
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
                        className="hover:bg-surface-2/60 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-fg">
                          <Link
                            href={`/contacts/${contact.id}`}
                            className="hover:text-accent"
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
                          {contact.phone || "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-fg-subtle">
                          {contact.email}
                        </td>
                        <td className="px-4 py-3">
                          {openDeal ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <StageBadge stage={openDeal.stage} />
                              <span className="text-fg truncate">
                                {openDeal.title}
                              </span>
                              <span className="text-fg-subtle tabular-nums whitespace-nowrap">
                                {formatCurrency(
                                  openDeal.amount,
                                  openDeal.currency
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="text-fg-subtle">\u2014</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-fg-subtle whitespace-nowrap">
                          {formatRelative(contact.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden border-t border-border divide-y divide-border">
              {pageContacts.map((contact) => {
                const openDeal = deals.find(
                  (d) =>
                    d.contactId === contact.id &&
                    d.stage !== "completed" &&
                    d.stage !== "lost"
                );
                return (
                  <div key={contact.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="text-sm font-medium text-fg hover:text-accent"
                        >
                          {contact.name}
                        </Link>
                        {contact.company && (
                          <div className="text-xs text-fg-subtle">
                            {contact.company}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-fg-subtle whitespace-nowrap">
                        {formatRelative(contact.updatedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                      <span>{contact.email}</span>
                      {contact.phone && <span>{contact.phone}</span>}
                    </div>
                    {openDeal && (
                      <div className="flex items-center gap-2 text-xs">
                        <StageBadge stage={openDeal.stage} />
                        <span className="text-fg truncate">{openDeal.title}</span>
                        <span className="text-fg-subtle tabular-nums">
                          {formatCurrency(openDeal.amount, openDeal.currency)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-4 pb-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                basePath="/contacts"
                searchParams={searchParamsForPagination}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
