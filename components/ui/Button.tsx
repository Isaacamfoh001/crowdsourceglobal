import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-blue-700 disabled:bg-blue-300",
  secondary:
    "bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900 disabled:bg-slate-400",
  outline:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 focus-visible:outline-slate-400 disabled:text-slate-400",
};

export function Button({
  variant = "primary",
  className = "",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
