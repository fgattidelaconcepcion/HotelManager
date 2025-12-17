import type { ButtonHTMLAttributes, ReactNode } from "react";


type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
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
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
