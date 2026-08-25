"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRIES } from "../../lib/countries";

/**
 * Searchable country picker (M17.1) — replaces free-typed country inputs
 * app-wide. Submits the exact country name string (never an ISO code) via
 * a hidden input sharing `name`, matching what every existing country
 * field already stores — see lib/countries.ts for why. Ghana sorts first
 * in the unfiltered list (Ghana-first UX) without special-casing any one
 * call site. No dropdown/combobox dependency — this is a small enough
 * pattern to own directly rather than pull in a library for.
 */
export function CountrySelect({
  name,
  label,
  defaultValue,
  required = false,
  disabled = false,
  hint,
  error,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  error?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const inputId = `${baseId}-input`;

  const filtered = query.trim()
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()))
    : COUNTRIES;

  function select(country: string) {
    setSelected(country);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.blur();
  }

  function openList() {
    if (disabled) return;
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      event.preventDefault();
      openList();
      return;
    }
    if (!open) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[activeIndex]) select(filtered[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-espresso-800">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          required={required}
          disabled={disabled}
          value={open ? query : selected}
          placeholder="Search countries…"
          onFocus={openList}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Deferred so a click on an option (onMouseDown, below) registers first.
            window.setTimeout(() => {
              setOpen(false);
              setQuery("");
            }, 120);
          }}
          className={`w-full rounded-lg border bg-ivory-50 px-3.5 py-3 pr-10 text-[15px] text-espresso-950 shadow-soft outline-none transition-colors placeholder:text-espresso-900/35 focus:border-espresso-800 focus:ring-2 focus:ring-espresso-800/10 ${
            error ? "border-danger-400" : "border-ivory-400"
          }`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        />
        <input type="hidden" name={name} value={selected} />
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-espresso-900/40"
          strokeWidth={1.75}
          aria-hidden="true"
        />

        {open ? (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-ivory-300 bg-ivory-50 py-1 shadow-lifted"
          >
            {filtered.length === 0 ? (
              <li className="px-3.5 py-3 text-sm text-espresso-900/50">No countries match &ldquo;{query}&rdquo;</li>
            ) : (
              filtered.map((country, index) => (
                <li
                  key={country}
                  role="option"
                  aria-selected={country === selected}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    select(country);
                  }}
                  className={`flex min-h-11 cursor-pointer items-center px-3.5 py-2.5 text-[15px] ${
                    index === activeIndex ? "bg-champagne-200/40" : ""
                  } ${country === selected ? "font-medium text-espresso-950" : "text-espresso-800"}`}
                >
                  {country}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
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
