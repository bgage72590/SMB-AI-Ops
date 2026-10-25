import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getInvoice, getContact, getDeal } from "@/lib/store";
import { formatCurrency, formatRelative } from "@/lib/format";
import { Breadcrumb } from "@/components/Breadcrumb";
import { InvoiceActions } from "@/components/InvoiceActions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice Detail | SMB AI Ops",
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
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        colors[status] || colors.draft
      }`}
    >
      {status}
    </span>
  );
}

export default async function InvoiceDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const user = await requireUser();
  const invoice = getInvoice(user.id, params.id);
  if (!invoice) notFound();

  const contact = getContact(user.id, invoice.contactId);
  const deal = invoice.dealId ? getDeal(user.id, invoice.dealId) : null;

  const base =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const publicUrl = `${base.replace(/\/$/, "")}/portal/invoice/${invoice.id}`;

  return (
    <div className="space-y-5 max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Quotes & Invoices", href: "/invoices" },
          { label: invoice.number },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-fg font-mono">
              {invoice.number}
            </h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-fg-muted mt-0.5">
            {invoice.type === "quote" ? "Quote" : "Invoice"} for{" "}
            {contact ? (
              <Link
                href={`/contacts/${contact.id}`}
                className="text-accent hover:underline"
              >
                {contact.name}
              </Link>
            ) : (
              "Unknown client"
            )}
            {deal && (
              <>
                {" "}&middot;{" "}
                <Link
                  href={`/deals/${deal.id}`}
                  className="text-accent hover:underline"
                >
                  {deal.title}
                </Link>
              </>
            )}
          </p>
        </div>
        <InvoiceActions invoiceId={invoice.id} status={invoice.status} publicUrl={publicUrl} />
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-border bg-surface shadow-[var(--shadow-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/50 text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
              <th className="text-left px-4 py-2.5">Description</th>
              <th className="text-center px-4 py-2.5">Qty</th>
              <th className="text-right px-4 py-2.5">Price</th>
              <th className="text-right px-4 py-2.5">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoice.lineItems.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-fg">{item.description}</td>
                <td className="px-4 py-3 text-center text-fg-muted tabular-nums">
                  {item.quantity}
                </td>
                <td className="px-4 py-3 text-right text-fg-muted tabular-nums">
                  {formatCurrency(item.unitPrice, "USD")}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatCurrency(item.total, "USD")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-border">
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right text-fg-muted text-sm">
                Subtotal
              </td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">
                {formatCurrency(invoice.subtotal, "USD")}
              </td>
            </tr>
            {invoice.tax > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-fg-muted text-sm">
                  Tax
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatCurrency(invoice.tax, "USD")}
                </td>
              </tr>
            )}
            <tr className="border-t border-border">
              <td colSpan={3} className="px-4 py-3 text-right font-semibold text-fg">
                Total
              </td>
              <td className="px-4 py-3 text-right text-lg font-bold tabular-nums">
                {formatCurrency(invoice.total, "USD")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {invoice.notes && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold mb-1">
            Notes
          </div>
          <p className="text-sm text-fg-muted whitespace-pre-wrap">
            {invoice.notes}
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-fg-subtle">Created</div>
          <div className="font-medium text-fg mt-0.5">
            {formatRelative(invoice.createdAt)}
          </div>
        </div>
        {invoice.sentAt && (
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="text-fg-subtle">Sent</div>
            <div className="font-medium text-fg mt-0.5">
              {formatRelative(invoice.sentAt)}
            </div>
          </div>
        )}
        {invoice.paidAt && (
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="text-fg-subtle">Paid</div>
            <div className="font-medium text-success mt-0.5">
              {formatRelative(invoice.paidAt)}
            </div>
          </div>
        )}
        {invoice.validUntil && (
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="text-fg-subtle">Valid until</div>
            <div className="font-medium text-fg mt-0.5">
              {new Date(invoice.validUntil).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
