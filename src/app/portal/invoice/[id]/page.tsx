import { notFound } from "next/navigation";
import { getInvoicePublic, getContact, getUserById } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quote / Invoice | SMB AI Ops",
};

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600",
    sent: "bg-blue-50 text-blue-600",
    accepted: "bg-green-50 text-green-600",
    declined: "bg-red-50 text-red-600",
    paid: "bg-green-50 text-green-700",
    void: "bg-gray-100 text-gray-500",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
        colors[status] || colors.draft
      }`}
    >
      {status === "paid" ? "Paid" : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function PortalInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const invoice = getInvoicePublic(params.id);
  if (!invoice) notFound();

  if (invoice.status === "draft") notFound();

  const contact = getContact(invoice.userId, invoice.contactId);
  const owner = getUserById(invoice.userId);

  return (
    <div className="min-h-screen bg-[#f7f5f0]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#1a9b8f] text-white text-xs font-bold">
                AI
              </span>
              {owner && (
                <span className="text-sm font-medium text-gray-700">
                  {owner.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-4">
              {invoice.type === "quote" ? "Quote" : "Invoice"} {invoice.number}
            </h1>
            {contact && (
              <p className="text-sm text-gray-500 mt-1">
                Prepared for {contact.name}
                {contact.email && <> &middot; {contact.email}</>}
              </p>
            )}
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wider text-gray-400 font-medium">
                <th className="text-left px-5 py-3">Description</th>
                <th className="text-center px-4 py-3">Qty</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-right px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoice.lineItems.map((item, i) => (
                <tr key={i}>
                  <td className="px-5 py-3.5 text-gray-900">
                    {item.description}
                  </td>
                  <td className="px-4 py-3.5 text-center text-gray-500 tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3.5 text-right text-gray-500 tabular-nums">
                    {formatCurrency(item.unitPrice, "USD")}
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium text-gray-900 tabular-nums">
                    {formatCurrency(item.total, "USD")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t border-gray-200 px-5 py-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium tabular-nums">
                {formatCurrency(invoice.subtotal, "USD")}
              </span>
            </div>
            {invoice.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax</span>
                <span className="tabular-nums">
                  {formatCurrency(invoice.tax, "USD")}
                </span>
              </div>
            )}
            <div className="flex justify-between text-base pt-2 border-t border-gray-100">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-gray-900 text-lg tabular-nums">
                {formatCurrency(invoice.total, "USD")}
              </span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Notes
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {invoice.notes}
            </p>
          </div>
        )}

        {invoice.validUntil && (
          <p className="text-xs text-gray-400 text-center">
            This {invoice.type} is valid until{" "}
            {new Date(invoice.validUntil).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}

        {invoice.status === "paid" && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200">
              <span className="text-green-600 text-sm font-medium">
                &#10003; Paid
              </span>
              {invoice.paidAt && (
                <span className="text-green-500 text-xs">
                  on{" "}
                  {new Date(invoice.paidAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-400 mt-8">
          Powered by SMB AI Ops
        </div>
      </div>
    </div>
  );
}
