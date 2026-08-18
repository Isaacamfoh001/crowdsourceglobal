/**
 * Provider-neutral payment interface (M10A). Domain code depends only on
 * this contract, never on a concrete provider — Moolre was the first real
 * implementation (M10A); Paystack is the second and, as of M10A.2, the
 * primary one. Both implement the exact same shape below.
 *
 * Deliberately NOT implemented by MockPaymentProvider: mock's dev/test UX
 * (customer explicitly picks "succeed"/"fail") is synchronous by design and
 * already fully served by the pre-existing `attemptMockPayment` flow in
 * modules/payments/service.ts. Forcing it through an async
 * initiate/verify/webhook shape it doesn't need would be artificial. The
 * checkout page selects between the two flows in exactly one place
 * (env.PAYMENT_PROVIDER) — that is the "centralized routing" boundary, not
 * a shared runtime interface between a sync and an async provider.
 *
 * Webhook signature verification is deliberately NOT part of this shared
 * interface: Moolre documents no signature mechanism at all (ADR 0006),
 * while Paystack's is a real HMAC-SHA512 check over the raw request body
 * that must happen before any JSON parsing. Each provider's own webhook
 * route handles authentication in whatever way is actually correct for
 * that provider, then hands an already-parsed, already-trusted-or-not body
 * to `parseWebhook` — which stays a pure "extract the fields we need"
 * function, identical in shape across providers.
 */

export type PaymentNetworkCode = "MTN" | "TELECEL" | "AT";

export type InitiatePaymentParams = {
  /** CrownSourceGlobal's own reference — also sent as Moolre's `externalref`/Paystack's `reference`. Never regenerated on a same-attempt retry. */
  reference: string;
  amount: number;
  currency: "GHS";
  network: PaymentNetworkCode;
  /** Normalized local Ghana format (0XXXXXXXXX). Never persisted. */
  phone: string;
  /** Required by Paystack's Charge API; ignored by providers that don't need it (Moolre). Never used for anything beyond the provider request itself. */
  customerEmail: string;
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
  readonly name: "MOOLRE" | "PAYSTACK";
  initiate(params: InitiatePaymentParams): Promise<InitiatePaymentOutcome>;
  verify(params: VerifyPaymentParams): Promise<VerifyPaymentOutcome>;
  parseWebhook(input: { body: unknown; sourceIp: string | null }): WebhookParseResult;
}
