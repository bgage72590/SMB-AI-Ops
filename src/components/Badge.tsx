import type { DealStage, EmailCategory, EmailPriority } from "@/lib/types";

const STAGE_COLORS: Record<DealStage, string> = {
  lead: "bg-ink-100 text-ink-700",
  qualified: "bg-blue-100 text-blue-800",
  proposal: "bg-amber-100 text-amber-800",
  negotiation: "bg-orange-100 text-orange-800",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-rose-100 text-rose-800",
};

const PRIORITY_COLORS: Record<EmailPriority, string> = {
  low: "bg-ink-100 text-ink-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-rose-100 text-rose-800",
};

const CATEGORY_LABELS: Record<EmailCategory, string> = {
  new_lead: "new lead",
  deal_update: "deal update",
  invoice: "invoice",
  follow_up_needed: "needs reply",
  scheduling: "scheduling",
  other: "other",
};

export function StageBadge({ stage }: { stage: DealStage }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[stage]}`}
    >
      {stage}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: EmailPriority }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[priority]}`}
    >
      {priority}
    </span>
  );
}

export function CategoryBadge({ category }: { category: EmailCategory }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent-soft text-accent">
      {CATEGORY_LABELS[category]}
    </span>
  );
}
