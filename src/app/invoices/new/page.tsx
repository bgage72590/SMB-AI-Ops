import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listContacts, listDeals } from "@/lib/store";
import { InvoiceForm } from "@/components/InvoiceForm";
import { Breadcrumb } from "@/components/Breadcrumb";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Quote / Invoice | SMB AI Ops",
};

export const dynamic = "force-dynamic";

export default function NewInvoicePage({
  searchParams,
}: {
  searchParams?: { dealId?: string; type?: string };
}) {
  const user = requireUser();
  const contacts = listContacts(user.id).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
  }));
  const deals = listDeals(user.id).map((d) => ({
    id: d.id,
    title: d.title,
    contactId: d.contactId,
    amount: d.amount,
    costMaterials: d.costMaterials,
    costLabor: d.costLabor,
  }));

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: "Quotes & Invoices", href: "/invoices" },
          { label: "New" },
        ]}
      />
      <h1 className="text-xl font-semibold text-fg">Create quote or invoice</h1>
      <InvoiceForm
        contacts={contacts}
        deals={deals}
        prefillDealId={searchParams?.dealId}
        prefillType={
          searchParams?.type === "invoice" ? "invoice" : "quote"
        }
      />
    </div>
  );
}
