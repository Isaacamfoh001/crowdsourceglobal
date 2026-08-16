import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 focus-visible:outline-brand-700 disabled:bg-stone-300 disabled:text-stone-500",
  secondary:
    "bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-950 focus-visible:outline-stone-900 disabled:bg-stone-300 disabled:text-stone-500",
  outline:
    "border border-stone-300 bg-white text-stone-900 hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-stone-400 disabled:text-stone-400",
  ghost:
    "bg-transparent text-stone-700 hover:bg-stone-100 focus-visible:outline-stone-400 disabled:text-stone-400",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-sm gap-1.5",
  md: "px-4.5 py-2.5 text-sm gap-2",
  lg: "px-6 py-3.5 text-base gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-semibold shadow-soft transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:shadow-none ${
        fullWidth ? "w-full" : ""
      } ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
