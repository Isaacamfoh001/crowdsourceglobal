import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-forest-800 text-ivory-50 hover:bg-forest-900 active:bg-forest-950 focus-visible:outline-forest-700 disabled:bg-ivory-300 disabled:text-espresso-900/40",
  secondary:
    "bg-espresso-900 text-ivory-50 hover:bg-espresso-950 active:bg-espresso-950 focus-visible:outline-espresso-800 disabled:bg-ivory-300 disabled:text-espresso-900/40",
  outline:
    "border border-ivory-400 bg-ivory-50 text-espresso-950 hover:border-champagne-400 hover:bg-ivory-100 focus-visible:outline-espresso-700 disabled:text-espresso-900/30",
  ghost:
    "bg-transparent text-espresso-800 hover:bg-ivory-100 focus-visible:outline-espresso-700 disabled:text-espresso-900/30",
  danger:
    "border border-danger-300 bg-ivory-50 text-danger-700 hover:border-danger-400 hover:bg-danger-50 focus-visible:outline-danger-600 disabled:border-ivory-300 disabled:text-espresso-900/30",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2.5 text-sm gap-1.5",
  md: "px-4.5 py-3 text-sm gap-2",
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
