import { cn } from "./cn";

// EmptyState is a labeled zero-state. A real illustration is overkill
// for now; we show a rounded icon slot with a monochrome emoji-like
// glyph, a headline, and a 1-line reassurance. Optional primary action
// slot lets callers wire up whatever CTA makes sense.
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center px-6 py-12 rounded-xl border border-dashed border-border bg-surface-2/50",
        className
      )}
    >
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent text-xl">
          {icon}
        </div>
      )}
      <div className="text-sm font-semibold text-fg">{title}</div>
      {description && (
        <div className="text-xs text-fg-subtle mt-1 max-w-sm">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
