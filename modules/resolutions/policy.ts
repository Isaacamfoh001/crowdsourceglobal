import type { CancellationEligibility } from "./types";

/**
 * Centralized cancellation-eligibility classification (M9 spec §9/§10).
 * This is a HINT for staff — every cancellation request still goes through
 * the same manual admin approve/reject decision (only authorized staff can
 * approve a refund or cancel a paid Fulfilment — see CLAUDE.md's "customer
 * cannot set financial state directly"); the hint only changes how quickly
 * staff can move, and lets the customer-facing UI explain what to expect.
 *
 * PENDING (payment confirmed, vendor hasn't started preparing) → SAFE.
 * PREPARING/READY/DISPATCHED (vendor has started or physically moved it) →
 * NEEDS_REVIEW. DELIVERED/COMPLETED/CANCELLED/EXCEPTION → BLOCKED: either
 * cancellation no longer applies (use the report-a-problem/return flow
 * instead) or it's already terminal.
 */
export function classifyCancellationEligibility(fulfilmentStatus: string): CancellationEligibility {
  if (fulfilmentStatus === "PENDING") return "SAFE";
  if (["PREPARING", "READY", "DISPATCHED"].includes(fulfilmentStatus)) return "NEEDS_REVIEW";
  return "BLOCKED";
}

/** A Fulfilment may only actually be cancelled from these statuses — enforced server-side, never left to the UI. */
export const CANCELLABLE_FULFILMENT_STATUSES = ["PENDING", "PREPARING", "READY"];

/**
 * Never trust a client-submitted refund total (M9 spec §30). Caps a
 * proposed refund amount against what remains refundable for one
 * OrderItem, given everything already approved for it across every case
 * that has ever touched it (M9 spec §58's "cumulative refunded/replaced
 * quantity/value cannot exceed the original purchase" rule).
 */
export function validateRefundAmount(params: {
  requestedAmount: number;
  alreadyApprovedAmount: number;
  lineTotal: number;
}): { ok: true } | { ok: false; error: string } {
  if (params.requestedAmount <= 0) {
    return { ok: false, error: "Refund amount must be greater than zero." };
  }
  const remaining = params.lineTotal - params.alreadyApprovedAmount;
  if (params.requestedAmount > remaining + 0.005) {
    return { ok: false, error: `This item has only GH₵${remaining.toFixed(2)} left refundable.` };
  }
  return { ok: true };
}

export function validateQuantity(params: {
  requestedQuantity: number;
  alreadyResolvedQuantity: number;
  purchasedQuantity: number;
}): { ok: true } | { ok: false; error: string } {
  if (params.requestedQuantity <= 0) {
    return { ok: false, error: "Quantity must be greater than zero." };
  }
  const remaining = params.purchasedQuantity - params.alreadyResolvedQuantity;
  if (params.requestedQuantity > remaining) {
    return { ok: false, error: `Only ${remaining} of ${params.purchasedQuantity} purchased units remain eligible for resolution.` };
  }
  return { ok: true };
}

const REFUND_BEARING_DECISIONS = new Set(["FULL_REFUND", "PARTIAL_REFUND", "RETURN_AND_REFUND"]);
const RETURN_REQUIRED_DECISIONS = new Set(["RETURN_AND_REFUND", "RETURN_AND_REPLACEMENT"]);
const REPLACEMENT_DECISIONS = new Set(["REPLACEMENT", "RETURN_AND_REPLACEMENT"]);

export function isRefundBearing(decision: string): boolean {
  return REFUND_BEARING_DECISIONS.has(decision);
}
export function requiresReturn(decision: string): boolean {
  return RETURN_REQUIRED_DECISIONS.has(decision);
}
export function isReplacement(decision: string): boolean {
  return REPLACEMENT_DECISIONS.has(decision);
}

const FULL_CLOSURE_DECISIONS = new Set(["FULL_REFUND", "RETURN_AND_REFUND"]);

/**
 * (M11.1) A full Vendor-attributable refund/return that covers the ENTIRE
 * affected FulfilmentItem quantity closes that Vendor's earning permanently
 * — there is no remaining fulfilment obligation, so the earning should be
 * CANCELLED rather than parked ON_HOLD waiting for a release that would
 * never legitimately restore it (see resolveCase's hold-release logic,
 * which only ever targets still-ON_HOLD earnings). A decision covering only
 * part of the FulfilmentItem's quantity never qualifies, even when the
 * decision TYPE is FULL_REFUND for that sub-quantity — the FulfilmentItem
 * (and its one VendorEarning) still carries unaffected remaining value.
 */
export function isFullVendorClosure(decision: string, quantityAffected: number, fulfilmentItemQuantity: number): boolean {
  return FULL_CLOSURE_DECISIONS.has(decision) && quantityAffected >= fulfilmentItemQuantity;
}
