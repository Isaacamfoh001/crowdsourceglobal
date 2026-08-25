export type BadgeTone = "brand" | "gold" | "neutral" | "onDark" | "success" | "warning" | "danger" | "info";

/**
 * The single source of truth for status/tone color across the app (M14.1).
 * Domain-specific badges (OrderStatusBadge, FulfilmentStatusBadge, etc. —
 * see components/ui/StatusBadge.tsx) map their own status vocabulary to one
 * of these tones rather than hand-rolling className strings — this is what
 * keeps "success" looking the same on a customer order as it does on a
 * vendor payout or an admin queue. "brand" and "gold" are the two premium
 * accent tones (champagne chip / deep espresso chip) — never used for
 * critical/status meaning, only editorial emphasis (eyebrows, feature tags).
 */
export const badgeToneClasses: Record<BadgeTone, string> = {
  brand: "bg-champagne-200 text-espresso-900",
  gold: "bg-espresso-900 text-champagne-300",
  neutral: "bg-ivory-200 text-espresso-800",
  onDark: "bg-ivory-50/10 text-white",
  success: "bg-success-100 text-success-800",
  warning: "bg-warning-100 text-warning-800",
  danger: "bg-danger-100 text-danger-800",
  info: "bg-info-100 text-info-800",
};

/** Uppercase, tracked "tag" style — eyebrows, category labels, severity chips. */
export function Badge({
  tone = "brand",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${badgeToneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
