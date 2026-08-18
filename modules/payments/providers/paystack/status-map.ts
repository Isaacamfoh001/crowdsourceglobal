import type { InitiatePaymentOutcome, VerifyPaymentOutcome } from "../../provider";
import { pesewasToGhs } from "../../../../lib/money";
import type { PaystackChargeResponse, PaystackInitializeResponse, PaystackVerifyResponse } from "./types";

/**
 * Maps Paystack's documented Charge API response to our closed outcome
 * union. Every status here is confirmed from current official
 * documentation (docs/decisions/0007) — none invented. "success"/"pending"
 * still map to ACCEPTED, never a bypass of independent verification: this
 * milestone's own explicit rule is "do not treat successful initiation as
 * successful payment."
 */
export function mapChargeResponse(res: PaystackChargeResponse): InitiatePaymentOutcome {
  const providerReference = res.data.id != null ? String(res.data.id) : null;
  switch (res.data.status) {
    case "pay_offline":
    case "success":
    case "pending":
      return { outcome: "ACCEPTED", providerReference, providerStatus: res.data.status };
    case "send_otp":
      return { outcome: "OTP_REQUIRED", providerStatus: res.data.status };
    case "failed":
      return { outcome: "REJECTED", reasonSafe: "Payment could not be started. Please try again.", providerStatus: res.data.status };
    default:
      return { outcome: "REJECTED", reasonSafe: "Payment could not be started.", providerStatus: res.data.status || "UNKNOWN" };
  }
}

/**
 * Maps Paystack's Verify Transaction response. Documented status values:
 * success, failed, abandoned, reversed. "abandoned" (customer never
 * completed) is mapped to FAILED — a definitive terminal outcome safe to
 * let the customer retry from, not an ambiguous one. "reversed" (a
 * post-hoc bank-side reversal) and anything unrecognized fall back to
 * PENDING rather than a guessed FAILED/SUCCEEDED — see
 * docs/decisions/0007 for the known limitation this leaves for a
 * genuinely already-confirmed Order later reported "reversed".
 */
export function mapVerifyResponse(res: PaystackVerifyResponse): VerifyPaymentOutcome {
  if (res.data.status === "success") {
    const auth = res.data.authorization;
    const cardDisplay = auth?.last4 && auth?.card_type ? { brand: auth.card_type, last4: auth.last4 } : null;
    return {
      status: "SUCCEEDED",
      providerReference: String(res.data.id),
      verifiedAmount: pesewasToGhs(res.data.amount),
      verifiedCurrency: res.data.currency,
      providerStatus: res.data.status,
      cardDisplay,
    };
  }
  if (res.data.status === "failed" || res.data.status === "abandoned") {
    return { status: "FAILED", reasonSafe: "Payment could not be completed.", providerStatus: res.data.status };
  }
  return { status: "PENDING", providerStatus: res.data.status || "UNKNOWN" };
}

/**
 * Card payments only (M10B) — maps POST /transaction/initialize's response.
 * This endpoint only ever reports whether hosted-Checkout was successfully
 * created, never payment success; the customer still must complete entry
 * on Paystack's page, and Verify Transaction remains the sole authority
 * (mapVerifyResponse above), unchanged from MoMo.
 */
export type InitiateCardPaymentOutcome =
  | { outcome: "REDIRECT"; authorizationUrl: string }
  | { outcome: "REJECTED"; reasonSafe: string; providerStatus: string }
  | { outcome: "UNKNOWN"; reasonSafe: string };

export function mapInitializeResponse(res: PaystackInitializeResponse): InitiateCardPaymentOutcome {
  if (!res.status || !res.data?.authorization_url) {
    return { outcome: "REJECTED", reasonSafe: "Payment could not be started. Please try again.", providerStatus: res.message || "UNKNOWN" };
  }
  return { outcome: "REDIRECT", authorizationUrl: res.data.authorization_url };
}
