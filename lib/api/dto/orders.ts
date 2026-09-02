import { serializeDate } from "../response";
import { absoluteImageUrl } from "../images";
import type { OrderDetailView, OrderSummaryView } from "../../../modules/orders/types";
import type { CustomerPackageTracking } from "../../../modules/fulfilment/types";
import type { CustomerCaseSummary } from "../../../modules/resolutions/types";

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

/** `GET /api/v1/orders` row (M26) — mirrors OrderSummaryView, list-safe (no vendor/fulfilment breakdown). */
export function toOrderListItemDTO(order: OrderSummaryView) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: serializeDate(order.createdAt),
    status: order.status,
    paymentStatus: order.paymentStatus,
    displayStatus: order.displayStatus,
    displayStatusLabel: order.displayStatusLabel,
    total: order.total,
    currency: order.currency,
    itemCount: order.itemCount,
    vendorCount: order.vendorCount,
    thumbnailUrl: order.thumbnailImageKey ? absoluteImageUrl(order.thumbnailImageKey) : null,
  };
}

/**
 * `GET /api/v1/orders/:id` full detail (M26) — supersedes the M24 minimal
 * shape above (that route now returns this; every M24 field is still
 * present, so the confirmation/payment screens that only read a subset
 * keep working unchanged). Mirrors OrderDetailView, with money left as raw
 * numbers (same convention `toOrderSummaryDTO`/toQuotationDetailDTO already
 * established for this domain) and vendor/case data pre-shaped for a
 * mobile-safe render — never vendor cost, never vendor settlement.
 */
export function toOrderDetailDTO(order: OrderDetailView) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: serializeDate(order.createdAt),
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    total: order.total,
    currency: order.currency,
    deliveryInfo: order.deliveryInfo,
    displayStatus: order.displayStatus,
    displayStatusLabel: order.displayStatusLabel,
    vendorGroups: order.vendorGroups.map((group) => ({
      vendorName: group.vendorName,
      subtotal: group.subtotal,
      items: group.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        vendor: item.vendor,
        imageUrl: item.imageKey ? absoluteImageUrl(item.imageKey) : null,
      })),
    })),
    packages: order.packages.map((p) => ({ fulfilmentId: p.fulfilmentId, vendorName: p.vendorName, status: p.status, statusLabel: p.statusLabel })),
    latestPaymentStatus: order.latestPaymentStatus,
    latestPayment: order.latestPayment
      ? {
          reference: order.latestPayment.reference,
          provider: order.latestPayment.provider,
          method: order.latestPayment.method,
          network: order.latestPayment.network,
          phoneMasked: order.latestPayment.phoneMasked,
          cardDisplay: order.latestPayment.cardDisplay,
          amount: order.latestPayment.amount,
          currency: order.latestPayment.currency,
          initiatedAt: serializeDate(order.latestPayment.initiatedAt),
        }
      : null,
  };
}

/** Per-vendor-package tracking timeline (M26) — mirrors fulfilmentService.getCustomerTracking's CustomerPackageTracking exactly. */
export function toCustomerTrackingDTO(tracking: CustomerPackageTracking[]) {
  return tracking.map((pkg) => ({
    fulfilmentId: pkg.fulfilmentId,
    vendorName: pkg.vendorName,
    items: pkg.items,
    steps: pkg.steps.map((step) => ({ key: step.key, label: step.label, done: step.done, current: step.current, at: step.at ? serializeDate(step.at) : null })),
    hasIssue: pkg.hasIssue,
    customerConfirmedReceiptAt: pkg.customerConfirmedReceiptAt ? serializeDate(pkg.customerConfirmedReceiptAt) : null,
    carrier: pkg.carrier,
    trackingReference: pkg.trackingReference,
  }));
}

/** Resolution/refund visibility on the Order Detail screen (M26 §16/§17) — status only, never the full case detail (see lib/api/dto/resolutions.ts for that). */
export function toOrderCaseSummaryDTO(caseRow: CustomerCaseSummary) {
  return {
    id: caseRow.id,
    caseNumber: caseRow.caseNumber,
    status: caseRow.status,
    statusLabel: caseRow.statusLabel,
    issueType: caseRow.issueType,
    createdAt: serializeDate(caseRow.createdAt),
  };
}
