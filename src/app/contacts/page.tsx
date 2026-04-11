import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { listContacts, listDeals } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function ClientsPage() {
  const user = requireUser();
  const contacts = listContacts(user.id);
  const deals = listDeals(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description={`${contacts.length} ${
          contacts.length === 1 ? "person" : "people"
        } in your book`}
      />

      <div className="bg-surface border border-border rounded-xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-fg-subtle text-[11px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Name</th>
              <th className="text-left px-4 py-2 font-semibold">Phone</th>
              <th className="text-left px-4 py-2 font-semibold">Email</th>
              <th className="text-left px-4 py-2 font-semibold">Open job</th>
              <th className="text-left px-4 py-2 font-semibold">Last touch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-fg-subtle">
                  No clients yet. Process your inbox to pull the first few in.
                </td>
              </tr>
            )}
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
                  className="hover:bg-surface-2/70 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium text-fg">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="hover:text-accent"
                    >
                      {contact.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {contact.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-fg-subtle">{contact.email}</td>
                  <td className="px-4 py-3">
                    {openDeal ? (
                      <span className="text-fg">
                        {openDeal.title}{" "}
                        <span className="text-fg-subtle tabular-nums">
                          · {formatCurrency(openDeal.amount, openDeal.currency)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-fg-subtle">
                    {formatRelative(contact.updatedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
