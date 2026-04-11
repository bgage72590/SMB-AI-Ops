import { listContacts, listDeals } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default function ContactsPage() {
  const user = requireUser();
  const contacts = listContacts(user.id);
  const deals = listDeals(user.id);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-ink-900">Contacts</h1>
        <p className="text-ink-500 mt-1">{contacts.length} people in your CRM</p>
      </section>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Company</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Open deal</th>
              <th className="text-left px-4 py-2">Last touch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-400">
                  No contacts yet. Process your inbox to populate the CRM.
                </td>
              </tr>
            )}
            {contacts.map((contact) => {
              const openDeal = deals.find(
                (d) =>
                  d.contactId === contact.id &&
                  d.stage !== "won" &&
                  d.stage !== "lost"
              );
              return (
                <tr key={contact.id} className="hover:bg-ink-50/50">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {contact.name}
                  </td>
                  <td className="px-4 py-3 text-ink-700">
                    {contact.company || "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-500">{contact.email}</td>
                  <td className="px-4 py-3">
                    {openDeal ? (
                      <span className="text-ink-900">
                        {openDeal.title}{" "}
                        <span className="text-ink-400">
                          · {formatCurrency(openDeal.amount, openDeal.currency)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-400">
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
