/**
 * Raw Moolre wire shapes, sourced from https://docs.moolre.com (Payments
 * API — Mobile Money Collection: initiate-payment, payment-status,
 * webhook). These types stay confined to this provider directory — no
 * Moolre-specific field/code ever leaks into modules/payments/service.ts
 * or the UI. See docs/decisions/0006-moolre-payment-provider.md for the
 * exact endpoints/fields this was verified against, including the honest
 * gaps (no documented failure/pending status-code enum beyond "SS01", no
 * documented webhook signature mechanism).
 */

export type MoolreEnvelope<TData> = {
  status: number | string;
  code: string;
  message: string | null;
  data: TData;
  go?: unknown;
};

export type MoolreInitiateResponse = MoolreEnvelope<string | null>;

export type MoolreStatusData = {
  txstatus: number;
  txtype: number;
  accountnumber: string;
  payer: string;
  payee: string;
  amount: string;
  value: string;
  transactionid: string;
  externalref: string;
  thirdpartyref: string;
  ts: string;
};

export type MoolreStatusResponse = MoolreEnvelope<MoolreStatusData | null>;

export type MoolreWebhookPayload = {
  status: number;
  code: string;
  message: string | null;
  data: Partial<MoolreStatusData> & { externalref?: string; transactionid?: string } | null;
};

/** Documented Mobile Money Collection channel codes — exact, not invented. */
export const MOOLRE_CHANNEL_CODES = {
  MTN: "13",
  TELECEL: "6",
  AT: "7",
} as const;

/** Source IPs documented for wallet callback delivery. Best-effort filter only — see the ADR for why this can't be treated as sufficient authentication. */
export const MOOLRE_CALLBACK_SOURCE_IPS = ["192.241.135.134", "2604:a880:400:d1:0:3:4cf0:c001"];
