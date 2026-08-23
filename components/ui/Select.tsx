import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

export function Select({ label, error, hint, id, className = "", children, ...props }: SelectProps) {
  const selectId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-espresso-800">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={`w-full appearance-none rounded-lg border bg-white px-3.5 py-3 pr-10 text-[15px] text-espresso-950 shadow-soft outline-none transition-colors focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 ${
            error ? "border-danger-400" : "border-ivory-400"
          } ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-espresso-900/40"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      {hint && !error ? (
        <p id={`${selectId}-hint`} className="text-xs text-espresso-900/55">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${selectId}-error`} className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
