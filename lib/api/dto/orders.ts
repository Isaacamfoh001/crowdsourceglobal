import { serializeDate } from "../response";
import type { OrderDetailView } from "../../../modules/orders/types";

/**
 * Minimal order DTO (M24) — deliberately NOT a full Orders API (no list
 * route, no vendor/fulfilment breakdown). This exists only so the mobile
 * quote-acceptance confirmation screen can show a real order reference and
 * an honest "pending payment" status instead of a bare internal id — full
 * native Orders is M25's scope (CLAUDE.md's payment boundary).
 */
export function toOrderSummaryDTO(order: OrderDetailView) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
    currency: order.currency,
    createdAt: serializeDate(order.createdAt),
  };
}
