import { serializeMoney } from "../response";
import type { PaymentStatusView } from "../../../modules/payments/types";

/**
 * Customer-facing payment status DTO (M25) — mirrors PaymentStatusView
 * exactly (already safe-fields-only, see that type's own doc comment).
 * Money becomes the shared `{ amount, currency }` wire shape; everything
 * else passes through unchanged, including `providerStatus` (used only to
 * pick safe UI copy client-side, never rendered verbatim).
 */
export function toPaymentStatusDTO(payment: PaymentStatusView) {
  return {
    paymentId: payment.paymentId,
    status: payment.status,
    method: payment.method,
    requiresOtp: payment.requiresOtp,
    network: payment.network,
    phoneMasked: payment.phoneMasked,
    cardDisplay: payment.cardDisplay,
    amount: serializeMoney(payment.amount, payment.currency),
    reference: payment.reference,
    failureReasonSafe: payment.failureReasonSafe,
    providerStatus: payment.providerStatus,
  };
}
