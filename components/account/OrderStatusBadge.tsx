import type { OrderDisplayStatus } from "../../modules/orders/display-status";

/** (M11.1) Tone by derived display status, not raw Order.status — see modules/orders/display-status.ts. */
const TONE: Record<OrderDisplayStatus, string> = {
  ORDER_CONFIRMED: "bg-gold-100 text-gold-800",
  PREPARING: "bg-brand-100 text-brand-800",
  COLLECTED: "bg-brand-100 text-brand-800",
  IN_TRANSIT: "bg-brand-100 text-brand-800",
  OUT_FOR_DELIVERY: "bg-brand-100 text-brand-800",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  ISSUE_UNDER_REVIEW: "bg-amber-100 text-amber-700",
  RETURN_IN_PROGRESS: "bg-amber-100 text-amber-700",
  REFUND_PROCESSING: "bg-amber-100 text-amber-700",
  REFUNDED: "bg-stone-200 text-stone-700",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-700",
  REPLACEMENT_IN_PROGRESS: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-stone-200 text-stone-600",
};

export function OrderStatusBadge({ status, label }: { status: OrderDisplayStatus; label: string }) {
  const tone = TONE[status] ?? "bg-stone-100 text-stone-700";

  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}
