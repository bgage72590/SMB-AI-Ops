"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

interface Props {
  deal: {
    id: string;
    title: string;
    amount: number;
    currency: string;
    costMaterials: number;
    costLabor: number;
    nextStep?: string;
  };
}

export function DealEditForm({ deal }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: deal.title,
    amount: String(deal.amount),
    costMaterials: String(deal.costMaterials),
    costLabor: String(deal.costLabor),
    nextStep: deal.nextStep || "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/deals", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: deal.id,
          title: form.title,
          amount: parseFloat(form.amount) || 0,
          costMaterials: parseFloat(form.costMaterials) || 0,
          costLabor: parseFloat(form.costLabor) || 0,
          nextStep: form.nextStep || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast("Job updated", "success");
      setEditing(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-[11px] text-fg-subtle hover:text-accent transition-colors"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-border">
      <div>
        <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Title</label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Revenue ($)</label>
          <input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={handleChange}
            className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent tabular-nums"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Materials ($)</label>
          <input
            name="costMaterials"
            type="number"
            min="0"
            step="0.01"
            value={form.costMaterials}
            onChange={handleChange}
            className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent tabular-nums"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Labor ($)</label>
        <input
          name="costLabor"
          type="number"
          min="0"
          step="0.01"
          value={form.costLabor}
          onChange={handleChange}
          className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent tabular-nums"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Next step</label>
        <input
          name="nextStep"
          value={form.nextStep}
          onChange={handleChange}
          className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="e.g., Send quote, Schedule visit..."
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.title}
          className="h-7 px-3 text-xs font-medium rounded-md bg-accent text-accent-fg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm({
              title: deal.title,
              amount: String(deal.amount),
              costMaterials: String(deal.costMaterials),
              costLabor: String(deal.costLabor),
              nextStep: deal.nextStep || "",
            });
            setEditing(false);
          }}
          className="h-7 px-3 text-xs font-medium rounded-md text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
