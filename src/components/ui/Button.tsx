import { forwardRef } from "react";
import { cn } from "./cn";

// Variants:
//   primary   — the single "do the thing" button on a page
//   secondary — neutral actions next to a primary
//   ghost     — inline / in-list actions where a box would be noisy
//   danger    — destructive actions
//   link      — text-only affordance that still reads as a button
type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none";

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-sm",
};

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:opacity-90 active:opacity-85",
  secondary:
    "bg-surface text-fg border border-border hover:bg-surface-2 active:bg-border",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90",
  link: "text-accent hover:underline underline-offset-2 h-auto px-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    loading = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        leadingIcon && <span className="inline-flex">{leadingIcon}</span>
      )}
      {children}
      {trailingIcon && !loading && (
        <span className="inline-flex">{trailingIcon}</span>
      )}
    </button>
  );
});
