"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";
import { useToast } from "./Toast";

interface Props {
  emailIds: string[];
}

export function BulkProcessButton({ emailIds }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const allSelected = selected.size === emailIds.length && emailIds.length > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(emailIds));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function processSelected() {
    if (selected.size === 0) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emailIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const count = data.results?.length ?? selected.size;
      toast(`Processed ${count} email${count === 1 ? "" : "s"}`, "success");
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Processing failed", "error");
    } finally {
      setProcessing(false);
    }
  }

  return {
    selected,
    toggle,
    toggleAll,
    allSelected,
    processSelected,
    processing,
    selectionCount: selected.size,
  };
}

export function BulkToolbar({
  count,
  total,
  allSelected,
  onToggleAll,
  onProcess,
  processing,
}: {
  count: number;
  total: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onProcess: () => void;
  processing: boolean;
}) {
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-3 py-2">
      <label className="flex items-center gap-2 text-xs text-fg-muted cursor-pointer">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          className="rounded border-border accent-accent"
        />
        {allSelected ? "Deselect all" : "Select all"}
      </label>
      {count > 0 && (
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onProcess}
          loading={processing}
        >
          Process {count} selected
        </Button>
      )}
      {count > 0 && (
        <span className="text-xs text-fg-subtle">
          {count} of {total} selected
        </span>
      )}
    </div>
  );
}

export function BulkCheckbox({
  id,
  checked,
  onToggle,
}: {
  id: string;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => onToggle(id)}
      className="shrink-0 rounded border-border accent-accent"
      aria-label="Select email"
    />
  );
}
