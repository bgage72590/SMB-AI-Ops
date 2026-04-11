import type { DealStage, EmailCategory, EmailPriority } from "@/lib/types";
import { Chip } from "./ui/Chip";

// Thin re-exports on top of the Chip primitive. Each component maps a
// domain enum to a tone + label so callers can just drop <StageBadge
// stage={job.stage} /> without knowing which tone is appropriate.

type Tone = React.ComponentProps<typeof Chip>["tone"];

const STAGE_TONES: Record<DealStage, Tone> = {
  inquiry: "neutral",
  quoted: "info",
  scheduled: "accent",
  in_progress: "warning",
  completed: "success",
  lost: "danger",
};

const STAGE_LABELS: Record<DealStage, string> = {
  inquiry: "inquiry",
  quoted: "quoted",
  scheduled: "scheduled",
  in_progress: "in progress",
  completed: "completed",
  lost: "lost",
};

const PRIORITY_TONES: Record<EmailPriority, Tone> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

const CATEGORY_LABELS: Record<EmailCategory, string> = {
  new_lead: "new inquiry",
  deal_update: "job update",
  invoice: "invoice",
  follow_up_needed: "needs reply",
  scheduling: "scheduling",
  other: "other",
};

const CATEGORY_TONES: Record<EmailCategory, Tone> = {
  new_lead: "accent",
  deal_update: "info",
  invoice: "success",
  follow_up_needed: "warning",
  scheduling: "accent",
  other: "neutral",
};

export function StageBadge({ stage }: { stage: DealStage }) {
  return <Chip tone={STAGE_TONES[stage]}>{STAGE_LABELS[stage]}</Chip>;
}

export function PriorityBadge({ priority }: { priority: EmailPriority }) {
  return <Chip tone={PRIORITY_TONES[priority]}>{priority}</Chip>;
}

export function CategoryBadge({ category }: { category: EmailCategory }) {
  return <Chip tone={CATEGORY_TONES[category]}>{CATEGORY_LABELS[category]}</Chip>;
}
