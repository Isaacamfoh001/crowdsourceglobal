export type MockPaymentOutcome = "succeed" | "fail";

export type MoolreNetworkCode = "MTN" | "TELECEL" | "AT";

/** Safe fields only — never internal provider debug data. Used by the customer polling endpoint and Order detail. */
export type PaymentStatusView = {
  paymentId: string;
  status: "INITIATED" | "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  requiresOtp: boolean;
  network: MoolreNetworkCode | null;
  phoneMasked: string | null;
  amount: number;
  currency: string;
  reference: string;
  failureReasonSafe: string | null;
  /** Raw provider status code (e.g. "TP17") — used only to pick safe, more specific copy; never shown verbatim to the customer. */
  providerStatus: string | null;
};
