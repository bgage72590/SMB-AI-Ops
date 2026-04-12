"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import type { DealStage } from "@/lib/types";

const STAGES: Array<{ value: DealStage; label: string }> = [
  { value: "inquiry", label: "Inquiry" },
  { value: "quoted", label: "Quoted" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
  { value: "lost", label: "Lost" },
];

interface Props {
  dealId: string;
  currentStage: DealStage;
}

export function StageChanger({ dealId, currentStage }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const stage = e.target.value as DealStage;
    if (stage === currentStage) return;
    setLoading(true);
    try {
      const res = await fetch("/api/deals", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: dealId, stage }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast(`Stage updated to ${STAGES.find((s) => s.value === stage)?.label}`, "success");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update stage", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={currentStage}
      onChange={handleChange}
      disabled={loading}
      aria-label="Change deal stage"
      className="h-7 px-2 text-xs font-medium rounded-md border border-border bg-surface text-fg hover:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 cursor-pointer"
    >
      {STAGES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
