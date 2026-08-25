import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

export function Textarea({ label, error, hint, id, className = "", rows = 4, ...props }: TextareaProps) {
  const textareaId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textareaId} className="text-sm font-medium text-espresso-800">
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        className={`w-full rounded-lg border bg-ivory-50 px-3.5 py-3 text-[15px] text-espresso-950 shadow-soft outline-none transition-colors placeholder:text-espresso-900/35 focus:border-espresso-800 focus:ring-2 focus:ring-espresso-800/10 ${
          error ? "border-danger-400" : "border-ivory-400"
        } ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
        {...props}
      />
      {hint && !error ? (
        <p id={`${textareaId}-hint`} className="text-xs text-espresso-900/55">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${textareaId}-error`} className="text-sm text-danger-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
