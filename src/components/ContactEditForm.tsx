"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

interface Props {
  contact: {
    id: string;
    name: string;
    email: string;
    company?: string;
    phone?: string;
    notes?: string;
  };
}

export function ContactEditForm({ contact }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: contact.name,
    email: contact.email,
    company: contact.company || "",
    phone: contact.phone || "",
    notes: contact.notes || "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: contact.id,
          name: form.name,
          email: form.email,
          company: form.company || undefined,
          phone: form.phone || undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast("Contact updated", "success");
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
        <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Name</label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Email</label>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Company</label>
        <input
          name="company"
          value={form.company}
          onChange={handleChange}
          className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Phone</label>
        <input
          name="phone"
          value={form.phone}
          onChange={handleChange}
          className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-fg-subtle font-medium">Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={3}
          className="mt-1 w-full text-sm bg-surface-2 border border-border rounded-md px-2.5 py-1.5 text-fg focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.name || !form.email}
          className="h-7 px-3 text-xs font-medium rounded-md bg-accent text-accent-fg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm({
              name: contact.name,
              email: contact.email,
              company: contact.company || "",
              phone: contact.phone || "",
              notes: contact.notes || "",
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
