import { cn } from "./cn";
import { Card } from "./Card";

// StatCard is a dashboard tile. It takes a label, a big value, and an
// optional hint + delta chip. Delta is the "+12% vs last week" line —
// tone auto-picks based on sign unless a `trend` prop forces it.
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  delta?: {
    value: string;
    /** `up` = success tone, `down` = danger tone, default auto. */
    trend?: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  className,
}: StatCardProps) {
  const tone =
    delta?.trend === "up"
      ? "text-success bg-success-soft"
      : delta?.trend === "down"
        ? "text-danger bg-danger-soft"
        : "text-fg-muted bg-surface-2";

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">
          {label}
        </div>
        {icon && <span className="text-fg-subtle">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold text-fg tabular-nums">
          {value}
        </div>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-full",
              tone
            )}
          >
            {delta.value}
          </span>
        )}
      </div>
      {hint && <div className="text-xs text-fg-subtle mt-1">{hint}</div>}
    </Card>
  );
}
