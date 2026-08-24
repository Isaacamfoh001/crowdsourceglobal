"use client";

import { useState } from "react";

/**
 * Sanitizes free-typed input down to a valid money string: digits and at
 * most one decimal point, at most 2 decimal places. Deliberately a plain
 * text input (inputMode="decimal" for a numeric mobile keyboard) rather
 * than type="number" — a native number input's up/down spinners step by
 * 0.01 by default, which is unusable for typing a price like 12500.00.
 * The server re-parses and validates this as the authoritative value —
 * this is a typing-experience improvement only, never a trust boundary.
 */
export function sanitizeMoneyInput(raw: string): string {
  let next = raw.replace(/[^0-9.]/g, "");
  const firstDot = next.indexOf(".");
  if (firstDot !== -1) {
    next = next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, "");
  }
  const [intPart, decPart] = next.split(".");
  if (decPart !== undefined) {
    next = `${intPart}.${decPart.slice(0, 2)}`;
  }
  return next;
}

export function MoneyInput({
  name,
  label,
  defaultValue,
  required,
  disabled,
  hint,
  currency = "GHS",
}: {
  name: string;
  label: string;
  defaultValue?: number | string | null;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  currency?: string;
}) {
  const [value, setValue] = useState(
    defaultValue !== null && defaultValue !== undefined && defaultValue !== "" ? String(defaultValue) : "",
  );
  const inputId = name;
  const symbol = currency === "GHS" ? "GH₵" : currency;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-espresso-800">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-medium text-espresso-900/55">
          {symbol}
        </span>
        <input
          id={inputId}
          name={name}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(sanitizeMoneyInput(event.target.value))}
          placeholder="0.00"
          required={required}
          disabled={disabled}
          className="w-full rounded-lg border border-ivory-400 bg-ivory-50 py-3 pl-12 pr-3.5 text-[15px] font-medium text-espresso-950 shadow-soft outline-none transition-colors focus:border-forest-700 focus:ring-2 focus:ring-forest-700/10 disabled:bg-ivory-100"
        />
      </div>
      {hint ? <p className="text-xs text-espresso-900/55">{hint}</p> : null}
    </div>
  );
}
