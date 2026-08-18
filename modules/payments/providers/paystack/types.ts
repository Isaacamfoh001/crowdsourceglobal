/**
 * Raw Paystack wire shapes, sourced from Paystack's current official
 * developer documentation (Charge API, Transaction API, Refund API,
 * Webhooks — docs-v2.paystack.com as of 2026-08). Confined to this
 * provider directory — no Paystack-specific field/status ever leaks into
 * modules/payments/service.ts or the UI. See
 * docs/decisions/0007-paystack-payment-provider.md for exactly which
 * fields were confirmed against fetchable documentation.
 */

export type PaystackEnvelope<TData> = {
  status: boolean;
  message: string;
  data: TData;
};

/** POST /charge response `data.status` values actually documented. */
export type PaystackChargeStatus = "pay_offline" | "send_otp" | "success" | "failed" | "pending";

export type PaystackChargeData = {
  reference: string;
  status: PaystackChargeStatus;
  display_text?: string;
  id?: number;
  amount?: number;
  gateway_response?: string;
};

export type PaystackChargeResponse = PaystackEnvelope<PaystackChargeData>;

/** GET /transaction/verify/:reference response `data.status` values. */
export type PaystackTransactionStatus = "success" | "failed" | "abandoned" | "reversed" | string;

export type PaystackTransactionData = {
  id: number;
  status: PaystackTransactionStatus;
  reference: string;
  amount: number;
  currency: string;
  gateway_response?: string;
  channel?: string;
};

export type PaystackVerifyResponse = PaystackEnvelope<PaystackTransactionData>;

export type PaystackRefundStatus = "pending" | "processed" | "failed" | string;

export type PaystackRefundData = {
  id: number;
  transaction: number | string;
  amount: number;
  currency: string;
  status: PaystackRefundStatus;
  customer_note?: string;
  merchant_note?: string;
};

export type PaystackRefundResponse = PaystackEnvelope<PaystackRefundData>;

export type PaystackWebhookPayload = {
  event: string;
  data: (PaystackTransactionData & Partial<PaystackChargeData>) | PaystackRefundData;
};

/**
 * Ghana Mobile Money provider codes Paystack's Charge API documents for
 * the mobile_money.provider field. Confirmed directly against Paystack's
 * current official Payment Channels documentation by Isaac (2026-08-18) —
 * no longer a flagged/ambiguous value (an earlier pass had tentatively
 * used "tgo" for AT, sourced from a single guide-page fetch that
 * conflicted with other sources; "atl" is the confirmed correct code).
 */
export const PAYSTACK_MOMO_PROVIDER_CODES = {
  MTN: "mtn",
  AT: "atl",
  TELECEL: "vod",
} as const;

/** Documented Paystack webhook source IPs — best-effort filter only, never sufficient alone (the real signature check is authoritative). */
export const PAYSTACK_WEBHOOK_SOURCE_IPS = ["52.31.139.75", "52.49.173.169", "52.214.14.220"];
