import { paystackClient } from "../payments/providers/paystack/client";
import { ghsToPesewas } from "../../lib/money";
import type { RefundExecutionContext, RefundExecutionResult, RefundExecutor } from "./executor";

/**
 * Paystack documents a real Refund API (POST /refund, GET /refund/:reference
 * — see docs/decisions/0007), unlike Moolre. Refunds are asynchronous
 * ("Refund has been queued for processing") — this executor returns
 * PENDING on acceptance, never COMPLETED; resolutionsService reconciles
 * the real outcome later via `fetchRefund` (admin-triggered or
 * webhook-triggered, both re-verifying independently — the webhook body
 * is never trusted alone, same discipline as the payment side).
 */
export const paystackRefundExecutor: RefundExecutor = {
  name: "paystack",

  async refund(context: RefundExecutionContext): Promise<RefundExecutionResult> {
    if (!context.paymentReference) {
      return {
        outcome: "FAILED",
        providerEventId: null,
        reasonSafe: "This refund has no linked payment reference and cannot be processed automatically.",
      };
    }

    const result = await paystackClient.createRefund({
      transaction: context.paymentReference,
      amount: ghsToPesewas(context.amount),
      currency: "GHS",
    });

    if (!result.ok) {
      if (result.kind === "TIMEOUT" || result.kind === "NETWORK") {
        // Genuinely uncertain whether the refund was created — never
        // blindly retry (could double-refund). Resolve later via
        // reconciliation, same principle as an uncertain payment initiation.
        return { outcome: "PENDING", providerEventId: null };
      }
      return { outcome: "FAILED", providerEventId: null, reasonSafe: "Refund could not be started. Please try again." };
    }

    const providerEventId = String(result.data.data.id);
    if (result.data.data.status === "processed") {
      return { outcome: "COMPLETED", providerEventId };
    }
    if (result.data.data.status === "failed") {
      return { outcome: "FAILED", providerEventId, reasonSafe: "Refund could not be processed." };
    }
    return { outcome: "PENDING", providerEventId };
  },
};
