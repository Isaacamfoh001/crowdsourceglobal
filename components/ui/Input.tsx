import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

export function Input({ label, error, hint, id, className = "", ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-espresso-800">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-lg border bg-ivory-50 px-3.5 py-3 text-[15px] text-espresso-950 shadow-soft outline-none transition-colors placeholder:text-espresso-900/35 focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 ${
          error ? "border-danger-400" : "border-ivory-400"
        } ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {hint && !error ? (
        <p id={`${inputId}-hint`} className="text-xs text-espresso-900/55">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
