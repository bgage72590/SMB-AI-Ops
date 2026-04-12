"use client";

import { useState, useEffect, useCallback } from "react";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string[];
}

interface CustomFieldSchemaEditorProps {
  entityType: "contact" | "deal";
}

export function CustomFieldSchemaEditor({
  entityType,
}: CustomFieldSchemaEditorProps) {
  const [schema, setSchema] = useState<FieldDef[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/custom-fields?entityType=${entityType}&schema=true`
    );
    if (res.ok) {
      const data = await res.json();
      setSchema(data.schema || []);
    }
    setLoaded(true);
  }, [entityType]);

  useEffect(() => {
    load();
  }, [load]);

  function addField() {
    setSchema((prev) => [
      ...prev,
      {
        key: `field_${prev.length + 1}`,
        label: "",
        type: "text",
      },
    ]);
  }

  function removeField(index: number) {
    setSchema((prev) => prev.filter((_, i) => i !== index));
  }

  function updateField(index: number, patch: Partial<FieldDef>) {
    setSchema((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...patch } : f))
    );
  }

  async function handleSave() {
    const valid = schema.filter((f) => f.key.trim() && f.label.trim());
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/custom-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, schema: valid }),
      });
      if (res.ok) {
        setMessage("Saved");
        setSchema(valid);
      } else {
        setMessage("Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="space-y-3">
      {schema.map((field, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end"
        >
          <div>
            <label className="text-[10px] text-fg-subtle">Key</label>
            <input
              value={field.key}
              onChange={(e) =>
                updateField(i, {
                  key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_"),
                })
              }
              className="w-full h-8 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg"
              placeholder="field_key"
            />
          </div>
          <div>
            <label className="text-[10px] text-fg-subtle">Label</label>
            <input
              value={field.label}
              onChange={(e) => updateField(i, { label: e.target.value })}
              className="w-full h-8 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg"
              placeholder="Display label"
            />
          </div>
          <div>
            <label className="text-[10px] text-fg-subtle">Type</label>
            <select
              value={field.type}
              onChange={(e) =>
                updateField(i, {
                  type: e.target.value as FieldDef["type"],
                })
              }
              className="h-8 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="select">Select</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => removeField(i)}
            className="h-8 px-2 text-xs text-danger hover:bg-danger/10 rounded-md transition-colors"
          >
            Remove
          </button>
          {field.type === "select" && (
            <div className="col-span-4">
              <label className="text-[10px] text-fg-subtle">
                Options (comma-separated)
              </label>
              <input
                value={(field.options || []).join(", ")}
                onChange={(e) =>
                  updateField(i, {
                    options: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full h-8 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg"
                placeholder="Option 1, Option 2, Option 3"
              />
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={addField}
          className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium rounded-md border border-border text-fg hover:bg-surface-2 transition-colors"
        >
          + Add field
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save schema"}
        </button>
        {message && (
          <span className="text-xs text-fg-subtle">{message}</span>
        )}
      </div>
    </div>
  );
}
