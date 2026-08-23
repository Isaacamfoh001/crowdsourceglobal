import { StatusBadge } from "../ui/StatusBadge";
import type { BadgeTone } from "../ui/Badge";
import type { OrderDisplayStatus } from "../../modules/orders/display-status";

/** (M11.1) Tone by derived display status, not raw Order.status — see modules/orders/display-status.ts. */
const TONE: Record<OrderDisplayStatus, BadgeTone> = {
  ORDER_CONFIRMED: "gold",
  PREPARING: "brand",
  COLLECTED: "brand",
  IN_TRANSIT: "brand",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "success",
  ISSUE_UNDER_REVIEW: "warning",
  RETURN_IN_PROGRESS: "warning",
  REFUND_PROCESSING: "warning",
  REFUNDED: "neutral",
  PARTIALLY_REFUNDED: "warning",
  REPLACEMENT_IN_PROGRESS: "warning",
  CANCELLED: "neutral",
};

export function OrderStatusBadge({ status, label }: { status: OrderDisplayStatus; label: string }) {
  return <StatusBadge tone={TONE[status] ?? "neutral"}>{label}</StatusBadge>;
}
