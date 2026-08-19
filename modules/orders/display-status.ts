/**
 * (M11.1) Centralized derivation of the small, human-facing Order/package
 * status shown to Customers and Vendors — built once here, never duplicated
 * across pages. This deliberately layers on TOP of the raw, historically-
 * accurate Fulfilment/Shipment/ResolutionCase/Refund/Return/Replacement
 * facts (never overwritten — see CLAUDE.md's commerce-integrity rules) to
 * answer the three questions a Buyer/Vendor/Admin should always be able to
 * answer: what's happening, what happens next, what can I do right now.
 *
 * Priority order (highest wins), matching the M11.1 brief exactly:
 *   REFUNDED / PARTIALLY_REFUNDED > RETURN_IN_PROGRESS > REFUND_PROCESSING
 *   > REPLACEMENT_IN_PROGRESS > ISSUE_UNDER_REVIEW > normal fulfilment stage.
 */

export type OrderDisplayStatus =
  | "ORDER_CONFIRMED"
  | "PREPARING"
  | "COLLECTED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "ISSUE_UNDER_REVIEW"
  | "RETURN_IN_PROGRESS"
  | "REFUND_PROCESSING"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "REPLACEMENT_IN_PROGRESS"
  | "CANCELLED";

export const ORDER_DISPLAY_STATUS_LABEL: Record<OrderDisplayStatus, string> = {
  ORDER_CONFIRMED: "Order confirmed",
  PREPARING: "Preparing",
  COLLECTED: "Collected",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  ISSUE_UNDER_REVIEW: "Issue under review",
  RETURN_IN_PROGRESS: "Return in progress",
  REFUND_PROCESSING: "Refund processing",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  REPLACEMENT_IN_PROGRESS: "Replacement in progress",
  CANCELLED: "Cancelled",
};

const NORMAL_STAGE_ORDER: OrderDisplayStatus[] = ["ORDER_CONFIRMED", "PREPARING", "COLLECTED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"];

const TERMINAL_CASE_STATUSES = new Set(["RESOLVED", "REJECTED", "CLOSED"]);
const RETURN_DECISIONS = new Set(["RETURN_AND_REFUND", "RETURN_AND_REPLACEMENT"]);
const REPLACEMENT_DECISIONS = new Set(["REPLACEMENT", "RETURN_AND_REPLACEMENT"]);
const DELIVERED_FULFILMENT_STATUSES = new Set(["DELIVERED", "COMPLETED"]);

/** Raw shape needed per Fulfilment ("package") — see ordersRepository's display-status select. */
export type DisplayStatusFulfilment = {
  id: string;
  status: string;
  vendorName: string;
  shipmentStatus: string | null;
  orderItemIds: string[];
};

/** Raw shape needed per ResolutionCase touching this Order — see ordersRepository's display-status select. */
export type DisplayStatusCase = {
  status: string;
  items: { orderItemId: string; approvedResolution: string | null; refundStatus: string | null }[];
  returnStatuses: string[];
  replacements: { originalOrderItemId: string; replacementFulfilmentStatus: string | null }[];
};

export type PackageDisplayStatus = {
  fulfilmentId: string;
  vendorName: string;
  status: OrderDisplayStatus;
};

function computePackageStatus(fulfilment: DisplayStatusFulfilment, cases: DisplayStatusCase[]): OrderDisplayStatus {
  const relevant: { caseRow: DisplayStatusCase; item: DisplayStatusCase["items"][number] }[] = [];
  for (const caseRow of cases) {
    for (const item of caseRow.items) {
      if (fulfilment.orderItemIds.includes(item.orderItemId)) relevant.push({ caseRow, item });
    }
  }

  if (relevant.length > 0) {
    // 1. Refund outcome — the strongest, most final signal. Full vs partial
    //    is scoped to THIS package's own OrderItems (a different vendor's
    //    package on the same Order never affects this count).
    const refundedOrderItemIds = new Set(relevant.filter((r) => r.item.refundStatus === "COMPLETED").map((r) => r.item.orderItemId));
    if (refundedOrderItemIds.size > 0) {
      return refundedOrderItemIds.size >= fulfilment.orderItemIds.length ? "REFUNDED" : "PARTIALLY_REFUNDED";
    }

    // 2. A return that hasn't finished yet — CrownSource is still expecting the item back.
    const hasActiveReturn = relevant.some(
      (r) => RETURN_DECISIONS.has(r.item.approvedResolution ?? "") && r.caseRow.returnStatuses.some((s) => s !== "COMPLETED"),
    );
    if (hasActiveReturn) return "RETURN_IN_PROGRESS";

    // 3. Refund approved/executing but not yet confirmed complete — this
    //    also covers FAILED (M11.1 fix): a refund that failed to process
    //    (e.g. no automated refund API for the payment provider, or a
    //    provider-side error) still needs CrownSource follow-up. It must
    //    never silently fall through to the raw fulfilment/shipment status
    //    below once the case itself is later marked Resolved/Closed — that
    //    would show a stale "Delivered" while a refund is actually stuck.
    const hasProcessingRefund = relevant.some(
      (r) => r.item.refundStatus === "APPROVED" || r.item.refundStatus === "PROCESSING" || r.item.refundStatus === "FAILED",
    );
    if (hasProcessingRefund) return "REFUND_PROCESSING";

    // 4. A replacement is owed and hasn't been delivered yet.
    const hasActiveReplacement = relevant.some((r) => {
      if (!REPLACEMENT_DECISIONS.has(r.item.approvedResolution ?? "")) return false;
      const replacement = r.caseRow.replacements.find((rp) => rp.originalOrderItemId === r.item.orderItemId);
      return !replacement || !DELIVERED_FULFILMENT_STATUSES.has(replacement.replacementFulfilmentStatus ?? "");
    });
    if (hasActiveReplacement) return "REPLACEMENT_IN_PROGRESS";

    // 5. Nothing decided/executed yet — the case itself is still open.
    const hasOpenCase = relevant.some((r) => !TERMINAL_CASE_STATUSES.has(r.caseRow.status));
    if (hasOpenCase) return "ISSUE_UNDER_REVIEW";
  }

  // No case ever affected this package (or every case touching it is fully
  // closed with no lasting effect, e.g. NO_ACTION) — fall back to the plain
  // logistics facts, never overwritten by any of the above.
  if (fulfilment.status === "EXCEPTION") return "ISSUE_UNDER_REVIEW"; // operational exception (M4 FulfilmentIssue), no ResolutionCase needed
  if (fulfilment.status === "CANCELLED") return "CANCELLED";
  if (DELIVERED_FULFILMENT_STATUSES.has(fulfilment.status)) return "DELIVERED";
  if (fulfilment.status === "DISPATCHED") {
    if (fulfilment.shipmentStatus === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
    if (fulfilment.shipmentStatus === "IN_TRANSIT") return "IN_TRANSIT";
    return "COLLECTED"; // COLLECTED, or (international, pre-CrownSource-receipt) still CREATED — both read as "moving" to the customer
  }
  if (fulfilment.status === "PREPARING" || fulfilment.status === "READY" || fulfilment.status === "ACCEPTED") return "PREPARING";
  return "ORDER_CONFIRMED"; // PENDING
}

export type OrderDisplayStatusResult = {
  overall: OrderDisplayStatus;
  packages: PackageDisplayStatus[];
};

/**
 * `orderStatus` is `Order.status` — used only for the zero-Fulfilment edge
 * case (payment not yet confirmed, or a pre-fulfilment cancellation). Once
 * any Fulfilment exists, the packages are authoritative and Order.status is
 * not consulted again here (a COMPLETED Order can still show DELIVERED per
 * package — see docs/domain/state-machines.md's paymentStatus/status split).
 */
export function computeOrderDisplayStatus(orderStatus: string, fulfilments: DisplayStatusFulfilment[], cases: DisplayStatusCase[]): OrderDisplayStatusResult {
  const packages: PackageDisplayStatus[] = fulfilments.map((f) => ({
    fulfilmentId: f.id,
    vendorName: f.vendorName,
    status: computePackageStatus(f, cases),
  }));

  if (packages.length === 0) {
    return { overall: orderStatus === "CANCELLED" ? "CANCELLED" : "ORDER_CONFIRMED", packages };
  }

  const statuses = packages.map((p) => p.status);
  let overall: OrderDisplayStatus;
  if (statuses.every((s) => s === "REFUNDED")) overall = "REFUNDED";
  else if (statuses.some((s) => s === "REFUNDED" || s === "PARTIALLY_REFUNDED")) overall = "PARTIALLY_REFUNDED";
  else if (statuses.some((s) => s === "RETURN_IN_PROGRESS")) overall = "RETURN_IN_PROGRESS";
  else if (statuses.some((s) => s === "REFUND_PROCESSING")) overall = "REFUND_PROCESSING";
  else if (statuses.some((s) => s === "REPLACEMENT_IN_PROGRESS")) overall = "REPLACEMENT_IN_PROGRESS";
  else if (statuses.some((s) => s === "ISSUE_UNDER_REVIEW")) overall = "ISSUE_UNDER_REVIEW";
  else if (statuses.every((s) => s === "CANCELLED")) overall = "CANCELLED";
  else {
    // Baseline: the least-advanced package sets the whole Order's headline
    // status — an Order isn't "Delivered" while one vendor's package is
    // still Preparing.
    const indices = statuses.map((s) => {
      const i = NORMAL_STAGE_ORDER.indexOf(s);
      return i === -1 ? 0 : i;
    });
    overall = NORMAL_STAGE_ORDER[Math.min(...indices)]!;
  }

  return { overall, packages };
}
