import { cn } from "./cn";

// Card is a container primitive. We also export CardHeader / CardBody /
// CardFooter as thin wrappers because 90% of the cards in this app
// follow the same layout.

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-xl shadow-card",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
  subtitle,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-5 pt-5 pb-3",
        className
      )}
    >
      <div className="min-w-0">
        <div className="font-semibold text-fg">{title}</div>
        {subtitle && (
          <div className="text-xs text-fg-subtle mt-0.5">{subtitle}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-border flex items-center justify-end gap-2",
        className
      )}
    >
      {children}
    </div>
  );
}
