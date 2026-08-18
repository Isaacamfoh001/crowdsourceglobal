/**
 * Provider-neutral payment interface (M10A). Domain code depends only on
 * this contract, never on a concrete provider — Moolre is the first real
 * implementation; a future Paystack adapter implements the same shape.
 *
 * Deliberately NOT implemented by MockPaymentProvider: mock's dev/test UX
 * (customer explicitly picks "succeed"/"fail") is synchronous by design and
 * already fully served by the pre-existing `attemptMockPayment` flow in
 * modules/payments/service.ts. Forcing it through an async
 * initiate/verify/webhook shape it doesn't need would be artificial. The
 * checkout page selects between the two flows in exactly one place
 * (env.PAYMENT_PROVIDER) — that is the "centralized routing" boundary, not
 * a shared runtime interface between a sync and an async provider.
 */

export type PaymentNetworkCode = "MTN" | "TELECEL" | "AT";

export type InitiatePaymentParams = {
  /** CrownSourceGlobal's own reference — also sent as Moolre's `externalref`. Never regenerated on a same-attempt retry. */
  reference: string;
  amount: number;
  currency: "GHS";
  network: PaymentNetworkCode;
  /** Normalized local Ghana format (0XXXXXXXXX). Never persisted. */
  phone: string;
  /** Present only when resubmitting after an OTP_REQUIRED outcome, same reference. */
  otpcode?: string;
};

export type InitiatePaymentOutcome =
  | { outcome: "ACCEPTED"; providerReference: string | null; providerStatus: string }
  | { outcome: "OTP_REQUIRED"; providerStatus: string }
  | { outcome: "REJECTED"; reasonSafe: string; providerStatus: string }
  | { outcome: "UNKNOWN"; reasonSafe: string };

export type VerifyPaymentParams = {
  reference: string;
  providerReference: string | null;
};

export type VerifyPaymentOutcome =
  | { status: "SUCCEEDED"; providerReference: string; verifiedAmount: number; verifiedCurrency: string; providerStatus: string }
  | { status: "FAILED"; reasonSafe: string; providerStatus: string }
  | { status: "PENDING"; providerStatus: string }
  | { status: "UNKNOWN"; reasonSafe: string };

export type WebhookParseResult =
  | {
      recognized: true;
      reference: string | null;
      providerReference: string | null;
      /** A hint only — never sufficient on its own to confirm a Payment. */
      claimedSucceeded: boolean;
      sourceIpTrusted: boolean;
    }
  | { recognized: false };

export interface PaymentProvider {
  readonly name: "MOOLRE";
  initiate(params: InitiatePaymentParams): Promise<InitiatePaymentOutcome>;
  verify(params: VerifyPaymentParams): Promise<VerifyPaymentOutcome>;
  parseWebhook(input: { body: unknown; sourceIp: string | null }): WebhookParseResult;
}
