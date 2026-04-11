import { cn } from "./cn";

// Chip is our generic labeled pill. All category / priority / stage
// badges funnel through this so tone stays consistent.
type Tone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Chip({
  tone = "neutral",
  className,
  children,
  ...rest
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide",
        TONES[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
