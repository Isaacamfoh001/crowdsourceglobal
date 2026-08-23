import { badgeToneClasses, type BadgeTone } from "./Badge";

/**
 * Title-case status pill — the shared rendering shell for every
 * domain-specific status badge (OrderStatusBadge, FulfilmentStatusBadge,
 * QuoteStatusBadge, SourcingStatusBadge, ListingStatusBadge). Each of those
 * keeps its own status→label and status→tone mapping (the domain vocabulary
 * genuinely differs per module); only the rendering and the tone→color
 * source of truth (badgeToneClasses) are shared, which is what keeps a
 * given tone looking identical everywhere it appears.
 */
export function StatusBadge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeToneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
