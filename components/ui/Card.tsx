import type { ElementType, ReactNode } from "react";

/**
 * The one shared "bordered surface" primitive (M14.1) — formalizes the
 * `rounded-2xl border border-stone-200 bg-white p-X` pattern that was
 * previously hand-typed independently on ~200 call sites across the app.
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
      className={`rounded-2xl border border-ivory-300 bg-white ${elevated ? "shadow-lifted" : "shadow-soft"} ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
