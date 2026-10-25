import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listInvoices, listContacts } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quotes & Invoices | SMB AI Ops",
  description: "Manage your quotes and invoices.",
};

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-surface-2 text-fg-muted",
    sent: "bg-info/10 text-info",
    accepted: "bg-success/10 text-success",
    declined: "bg-danger/10 text-danger",
    paid: "bg-success/10 text-success",
    void: "bg-surface-2 text-fg-subtle",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
        colors[status] || colors.draft
      }`}
    >
      {status}
    </span>
  );
}

export default async function InvoicesPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireUser();
  const tab = searchParams?.tab === "invoices" ? "invoices" : "quotes";
  const all = listInvoices(user.id, {
    type: tab === "invoices" ? "invoice" : "quote",
  });
  const contacts = listContacts(user.id);
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const quotes = listInvoices(user.id, { type: "quote" });
  const invoices = listInvoices(user.id, { type: "invoice" });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Quotes &amp; Invoices</h1>
          <p className="text-sm text-fg-muted mt-0.5">
            {quotes.length} quote{quotes.length !== 1 ? "s" : ""} &middot;{" "}
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg bg-accent text-accent-fg hover:opacity-90 transition-opacity shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New {tab === "invoices" ? "invoice" : "quote"}
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <Link
          href="/invoices?tab=quotes"
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "quotes"
              ? "border-accent text-accent"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          Quotes ({quotes.length})
        </Link>
        <Link
          href="/invoices?tab=invoices"
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "invoices"
              ? "border-accent text-accent"
              : "border-transparent text-fg-muted hover:text-fg"
          }`}
        >
          Invoices ({invoices.length})
        </Link>
      </div>

      {all.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface py-14 text-center">
          <div className="text-sm font-medium text-fg">
            No {tab} yet
          </div>
          <p className="text-xs text-fg-subtle mt-1 max-w-xs mx-auto">
            Create your first {tab === "invoices" ? "invoice" : "quote"} from a
            job or from scratch.
          </p>
        </div>
      )}

      {/* Table */}
      {all.length > 0 && (
        <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
                <th className="text-left px-4 py-2.5">Number</th>
                <th className="text-left px-4 py-2.5">Client</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Total</th>
                <th className="text-right px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {all.map((inv) => {
                const contact = contactMap.get(inv.contactId);
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-surface-2/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="font-medium text-fg hover:text-accent transition-colors font-mono text-xs"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {contact?.name || "Unknown"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatCurrency(inv.total, "USD")}
                    </td>
                    <td className="px-4 py-3 text-right text-fg-subtle text-xs whitespace-nowrap">
                      {formatRelative(inv.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
