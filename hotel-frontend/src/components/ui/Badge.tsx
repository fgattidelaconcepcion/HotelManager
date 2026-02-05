import type { ReactNode, HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "outline";
type BadgeSize = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  pill?: boolean;
  children: ReactNode;
  /** Optional: improves a11y when the text is not enough */
  ariaLabel?: string;
}

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-red-100 text-red-800",
  outline: "bg-transparent border border-slate-200 text-slate-700",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-[11px] px-2 py-0.5",
  md: "text-xs px-2.5 py-1",
};

export function Badge({
  variant = "default",
  size = "md",
  pill = true,
  children,
  className,
  ariaLabel,
  title,
  ...rest
}: BadgeProps) {
  return (
    <span
      aria-label={ariaLabel}
      title={title}
      className={cx(
        "inline-flex items-center font-medium whitespace-nowrap",
        pill ? "rounded-full" : "rounded-md",
        "leading-none",
        variantClasses[variant],
        sizeClasses[size],
        variant === "outline" ? "" : "border border-transparent",
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
