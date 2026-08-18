export type MockPaymentOutcome = "succeed" | "fail";

export type MobileMoneyNetworkCode = "MTN" | "TELECEL" | "AT";

export type PaymentMethodCode = "MOCK" | "MOBILE_MONEY" | "CARD";

/** Safe fields only — never internal provider debug data. Used by the customer polling endpoint and Order detail. */
export type PaymentStatusView = {
  paymentId: string;
  status: "INITIATED" | "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  method: PaymentMethodCode;
  requiresOtp: boolean;
  network: MobileMoneyNetworkCode | null;
  phoneMasked: string | null;
  /** Card payments only (M10B) — brand/last4 only, never present for MoMo/mock. Never the PAN/CVV/PIN/OTP. */
  cardDisplay: { brand: string; last4: string } | null;
  amount: number;
  currency: string;
  reference: string;
  failureReasonSafe: string | null;
  /** Raw provider status code (e.g. "TP17") — used only to pick safe, more specific copy; never shown verbatim to the customer. */
  providerStatus: string | null;
};
