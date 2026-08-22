import type { PayoutDestinationSnapshot } from "./types";

/**
 * Provider-neutral automated payout boundary (M12) — exists purely so
 * modules/vendor-finance's settlement logic never talks to Paystack's wire
 * format directly, the same reasoning as modules/payments/provider.ts and
 * modules/refunds/executor.ts. Paystack is the only implementation
 * required for V1 (paystack-payout-provider.ts); a future Hubtel adapter
 * would implement this same shape, not touch settlement logic.
 */

export type ResolveRecipientParams = {
  /** The settlement's OWN immutable destinationSnapshot — never the Vendor's possibly-since-changed current destination. */
  destination: PayoutDestinationSnapshot;
  /** Account/recipient display name at the provider — the settlement's Vendor name. */
  vendorName: string;
};

export type InitiatePayoutParams = {
  /** CrownSourceGlobal's own reference for this attempt — see lib/payout-number.ts. Never regenerated mid-attempt. */
  reference: string;
  /** Server-authoritative settlement.netAmount — never client input. */
  amount: number;
  currency: "GHS";
  /** Resolved once per settlement via resolveRecipient, reused on retry. */
  recipientCode: string;
  /** Safe, non-secret narration shown in the Vendor's bank/MoMo credit notification. */
  reason: string;
};

/**
 * Both `initiate` and a later `verify`/webhook reconciliation collapse to
 * this same three-way-plus-uncertain outcome — one funnel, mirroring
 * modules/payments/service.ts's `applyVerifyOutcome` and
 * modules/refunds/executor.ts's `RefundExecutionResult`.
 */
export type PayoutStatusOutcome =
  | { status: "PAID"; providerReference: string; transferCode: string | null }
  | { status: "PROCESSING"; transferCode: string | null }
  | { status: "FAILED"; reasonSafe: string }
  /** Network/timeout — genuinely unknown whether Paystack received/processed the request. Never treated as PROCESSING vs FAILED by guesswork; resolved later via verify(). */
  | { status: "UNKNOWN" };

export interface PayoutProvider {
  readonly name: "PAYSTACK";
  /** Resolves (creating if needed) a provider recipient for this exact destination. Never called with a Vendor's live/current destination — only a settlement's locked snapshot. */
  resolveRecipient(params: ResolveRecipientParams): Promise<{ ok: true; value: string } | { ok: false; error: string }>;
  initiate(params: InitiatePayoutParams): Promise<PayoutStatusOutcome>;
  /** Independent re-verification by CrownSourceGlobal's own reference — used by admin "Check status" and webhook reconciliation, never trusting a webhook body alone. */
  verify(reference: string): Promise<PayoutStatusOutcome>;
}
