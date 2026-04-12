"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

interface Contact {
  id: string;
  name: string;
  email: string;
}

interface Deal {
  id: string;
  title: string;
  contactId: string;
  amount: number;
  costMaterials: number;
  costLabor: number;
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Props {
  contacts: Contact[];
  deals: Deal[];
  prefillDealId?: string;
  prefillType?: "quote" | "invoice";
}

export function InvoiceForm({
  contacts,
  deals,
  prefillDealId,
  prefillType,
}: Props) {
  const router = useRouter();
  const [type, setType] = useState<"quote" | "invoice">(
    prefillType || "quote"
  );
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState(prefillDealId || "");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDealChange(id: string) {
    setDealId(id);
    const deal = deals.find((d) => d.id === id);
    if (deal) {
      setContactId(deal.contactId);
      const newItems: LineItem[] = [];
      if (deal.costLabor > 0) {
        newItems.push({
          description: "Labor",
          quantity: 1,
          unitPrice: deal.costLabor,
          total: deal.costLabor,
        });
      }
      if (deal.costMaterials > 0) {
        newItems.push({
          description: "Materials",
          quantity: 1,
          unitPrice: deal.costMaterials,
          total: deal.costMaterials,
        });
      }
      if (newItems.length === 0) {
        newItems.push({
          description: deal.title,
          quantity: 1,
          unitPrice: deal.amount,
          total: deal.amount,
        });
      }
      setItems(newItems);
    }
  }

  function updateItem(index: number, field: string, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updated.total = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      })
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0, total: 0 },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const subtotal = items.reduce((s, item) => s + item.total, 0);
  const total = subtotal + tax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!contactId) {
      setError("Select a client.");
      return;
    }
    if (items.length === 0 || items.every((i) => !i.description)) {
      setError("Add at least one line item.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          contactId,
          dealId: dealId || undefined,
          lineItems: items.filter((i) => i.description),
          tax,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Failed to create. Check your input.");
        return;
      }
      const data = await res.json();
      router.push(`/invoices/${data.invoice.id}`);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Type toggle */}
      <div className="flex gap-2">
        {(["quote", "invoice"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              type === t
                ? "border-accent bg-accent/5 text-accent"
                : "border-border text-fg-muted hover:border-fg-subtle"
            }`}
          >
            {t === "quote" ? "Quote" : "Invoice"}
          </button>
        ))}
      </div>

      {/* Deal link */}
      {deals.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-fg-muted mb-1">
            From job (optional)
          </label>
          <select
            value={dealId}
            onChange={(e) => handleDealChange(e.target.value)}
            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40"
          >
            <option value="">None</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Client */}
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">
          Client
        </label>
        <select
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          required
          className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40"
        >
          <option value="">Select a client</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.email})
            </option>
          ))}
        </select>
      </div>

      {/* Line items */}
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-2">
          Line items
        </label>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
                className="flex-1 h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <input
                type="number"
                min="0"
                step="1"
                value={item.quantity}
                onChange={(e) =>
                  updateItem(i, "quantity", parseFloat(e.target.value) || 0)
                }
                className="w-16 h-9 px-2 text-sm text-center rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40"
                title="Qty"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) =>
                  updateItem(
                    i,
                    "unitPrice",
                    parseFloat(e.target.value) || 0
                  )
                }
                className="w-24 h-9 px-2 text-sm text-right rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40"
                title="Unit price"
              />
              <span className="w-20 h-9 flex items-center justify-end text-sm font-medium text-fg tabular-nums">
                ${item.total.toFixed(2)}
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="h-9 w-9 flex items-center justify-center text-fg-subtle hover:text-danger transition-colors"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="mt-2 text-xs text-accent hover:underline font-medium"
        >
          + Add line item
        </button>
      </div>

      {/* Tax */}
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">
          Tax
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={tax}
          onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
          className="w-32 h-9 px-3 text-sm rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-border bg-surface-2/50 p-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-fg-muted">Subtotal</span>
          <span className="font-medium tabular-nums">${subtotal.toFixed(2)}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between">
            <span className="text-fg-muted">Tax</span>
            <span className="tabular-nums">${tax.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 border-t border-border">
          <span className="font-medium text-fg">Total</span>
          <span className="font-bold text-fg tabular-nums">
            ${total.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-fg-muted mb-1">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Payment terms, scope notes, etc."
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-fg focus:outline-none focus:ring-2 focus:ring-ring/40 resize-none"
        />
      </div>

      {error && (
        <div className="text-sm text-danger bg-danger-soft border border-danger/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Button type="submit" variant="primary" disabled={saving}>
        {saving
          ? "Creating..."
          : `Create ${type === "quote" ? "quote" : "invoice"}`}
      </Button>
    </form>
  );
}
