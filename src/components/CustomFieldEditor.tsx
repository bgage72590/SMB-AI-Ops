"use client";

import { useState, useEffect, useCallback } from "react";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select";
  options?: string[];
}

interface CustomFieldEditorProps {
  entityType: "contact" | "deal";
  entityId: string;
}

export function CustomFieldEditor({
  entityType,
  entityId,
}: CustomFieldEditorProps) {
  const [schema, setSchema] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [schemaRes, valuesRes] = await Promise.all([
      fetch(
        `/api/custom-fields?entityType=${entityType}&schema=true`
      ),
      fetch(
        `/api/custom-fields?entityType=${entityType}&entityId=${entityId}`
      ),
    ]);
    if (schemaRes.ok) {
      const data = await schemaRes.json();
      setSchema(data.schema || []);
    }
    if (valuesRes.ok) {
      const data = await valuesRes.json();
      setValues(data.fields || {});
    }
    setLoaded(true);
  }, [entityType, entityId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, fields: values }),
      });
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;
  if (schema.length === 0) {
    return (
      <p className="text-xs text-fg-subtle py-2">
        No custom fields defined.{" "}
        <a
          href="/settings"
          className="text-accent hover:underline"
        >
          Add fields in settings
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        Custom fields
      </h4>
      {schema.map((field) => (
        <div key={field.key} className="space-y-1">
          <label className="text-xs font-medium text-fg-muted">
            {field.label}
          </label>
          {field.type === "select" ? (
            <select
              value={(values[field.key] as string) ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field.key]: e.target.value }))
              }
              className="w-full h-8 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg"
            >
              <option value="">--</option>
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              value={(values[field.key] as string) ?? ""}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  [field.key]:
                    field.type === "number"
                      ? parseFloat(e.target.value) || ""
                      : e.target.value,
                }))
              }
              className="w-full h-8 rounded-md border border-border bg-surface-2 px-2 text-sm text-fg"
            />
          )}
        </div>
      ))}
      <button
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium rounded-md bg-accent text-accent-fg hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save fields"}
      </button>
    </div>
  );
}
