import Link from "next/link";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { StageBadge } from "@/components/Badge";
import { listContacts, listDeals } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function ClientsPage() {
  const user = requireUser();
  const contacts = listContacts(user.id);
  const deals = listDeals(user.id);

  const withOpenJob = contacts.filter((c) =>
    deals.some(
      (d) =>
        d.contactId === c.id && d.stage !== "completed" && d.stage !== "lost"
    )
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description={`${contacts.length} in your book · ${withOpenJob} with an open job`}
      />

      <Card className="overflow-hidden">
        <CardHeader
          title="All clients"
          subtitle="Sorted by most recent activity"
        />
        {contacts.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              icon="👥"
              title="No clients yet"
              description="Process your inbox to pull the first few in — any real inbound email becomes a client record."
            />
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-border">
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
                  {contacts.map((contact) => {
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
                          {contact.phone || "—"}
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
                            <span className="text-fg-subtle">—</span>
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
        )}
      </Card>
    </div>
  );
}
