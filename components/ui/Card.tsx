import type { ElementType, ReactNode } from "react";

/**
 * The one shared "bordered surface" primitive (M14.4). Deliberately flat —
 * a hairline border on the ivory canvas, no radius theatrics, no shadow at
 * rest — because the previous `rounded-2xl` + `shadow-soft` combination,
 * repeated on every block of every operational page, was exactly the
 * "generic SaaS dashboard" texture the M14.4 redesign rejected. `elevated`
 * is reserved for content that's genuinely lifted off the page (a popover,
 * a sticky summary) — not a default department every card reaches for.
 * `padded={false}` opts out for callers that need to control internal
 * spacing themselves (e.g. a card containing its own header band).
 */
export function Card({
  as: Tag = "div",
  padded = true,
  elevated = false,
  className = "",
  children,
}: {
  as?: ElementType;
  padded?: boolean;
  elevated?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`rounded-lg border border-ivory-300 bg-ivory-50 ${elevated ? "shadow-lifted" : ""} ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
