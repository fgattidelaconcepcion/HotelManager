import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Here I keep a small set of variants for consistent styling.
 *
 * IMPORTANT:
 * - Netlify failed because the app used `variant="default"`,
 *   but `variantClasses` did not include the "default" key.
 * - So here I support "default" as an alias of "primary".
 */
export type ButtonVariant = "default" | "primary" | "secondary" | "ghost" | "danger";

/**
 * Here I reuse native button props, so onClick / disabled / type / etc work normally.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

/**
 * Here I define the CSS classes for each variant.
 * - "default" is intentionally the same as "primary" so both work.
 */
const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed",
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed",
  secondary:
    "bg-slate-800 text-white hover:bg-slate-900 disabled:bg-slate-500 disabled:cursor-not-allowed",
  ghost:
    "border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  type, // I read type explicitly so I can provide a safe default.
  ...props
}: ButtonProps) {
  /**
   * Critical UX fix:
   * Here I default to type="button" so clicking a button inside a <form>
   * does NOT submit the form accidentally.
   *
   * When I *do* want to submit a form, I pass type="submit" explicitly.
   */
  const safeType = type ?? "button";

  return (
    <button
      {...props}
      type={safeType}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
