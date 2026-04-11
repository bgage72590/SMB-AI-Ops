import { cn } from "./cn";

// PageHeader is the top block on every app page. It renders a title,
// optional eyebrow label, optional description, and a slot for
// primary/secondary actions on the right. One component means copy
// density (type scale, spacing) stays consistent across the app.
interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-wider text-fg-subtle font-semibold mb-1">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-semibold text-fg leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-fg-muted mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </section>
  );
}
