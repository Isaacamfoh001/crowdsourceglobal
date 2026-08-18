import crypto from "node:crypto";
import { env } from "../../../../lib/env";
import { ghsToPesewas } from "../../../../lib/money";
import type {
  InitiatePaymentOutcome,
  InitiatePaymentParams,
  PaymentProvider,
  VerifyPaymentOutcome,
  VerifyPaymentParams,
  WebhookParseResult,
} from "../../provider";
import { paystackClient } from "./client";
import { mapChargeResponse, mapInitializeResponse, mapVerifyResponse, type InitiateCardPaymentOutcome } from "./status-map";
import { PAYSTACK_MOMO_PROVIDER_CODES, PAYSTACK_WEBHOOK_SOURCE_IPS, type PaystackTransactionData, type PaystackWebhookPayload } from "./types";

/**
 * HMAC-SHA512 of the raw request body, using the secret key — Paystack's
 * documented webhook authenticity mechanism (unlike Moolre, which
 * documents none — see ADR 0006/0007). Must run over the exact raw bytes
 * Paystack sent, before any JSON parsing, or the signature will never
 * match. Timing-safe comparison to avoid a timing side-channel.
 */
export function verifyPaystackSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader || !env.PAYSTACK_SECRET_KEY) return false;
  const expected = crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(signatureHeader, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

/**
 * Translates CrownSourceGlobal's provider-neutral requests into Paystack's
 * documented wire format and back. This is the only place Paystack
 * mobile-money provider codes, headers, or field names are assembled.
 */
export const paystackPaymentProvider: PaymentProvider = {
  name: "PAYSTACK",

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentOutcome> {
    const result = params.otpcode
      ? await paystackClient.submitOtp({ otp: params.otpcode, reference: params.reference })
      : await paystackClient.createCharge({
          email: params.customerEmail,
          amount: ghsToPesewas(params.amount),
          currency: params.currency,
          reference: params.reference,
          mobile_money: { phone: params.phone, provider: PAYSTACK_MOMO_PROVIDER_CODES[params.network] },
        });

    if (!result.ok) {
      if (result.kind === "TIMEOUT" || result.kind === "NETWORK") {
        return { outcome: "UNKNOWN", reasonSafe: "Payment is still processing. Please check status shortly." };
      }
      return { outcome: "REJECTED", reasonSafe: "Payment could not be started. Please try again.", providerStatus: `HTTP_${result.status ?? "ERR"}` };
    }

    return mapChargeResponse(result.data);
  },

  async verify(params: VerifyPaymentParams): Promise<VerifyPaymentOutcome> {
    const result = await paystackClient.verifyTransaction(params.reference);

    if (!result.ok) {
      return { status: "UNKNOWN", reasonSafe: "Could not verify payment status right now." };
    }

    return mapVerifyResponse(result.data);
  },

  parseWebhook(input: { body: unknown; sourceIp: string | null }): WebhookParseResult {
    if (typeof input.body !== "object" || input.body === null) {
      return { recognized: false };
    }
    const payload = input.body as PaystackWebhookPayload;
    if (!payload.event || !payload.event.startsWith("charge.")) {
      return { recognized: false };
    }
    const data = payload.data as PaystackTransactionData;
    const reference = typeof data.reference === "string" ? data.reference : null;
    const providerReference = data.id != null ? String(data.id) : null;
    if (!reference && !providerReference) {
      return { recognized: false };
    }

    return {
      recognized: true,
      reference,
      providerReference,
      claimedSucceeded: data.status === "success",
      // Signature is verified once at the webhook route (before this
      // function ever runs) — this IP check is a secondary, best-effort
      // signal only, never treated as sufficient by itself.
      sourceIpTrusted: input.sourceIp !== null && PAYSTACK_WEBHOOK_SOURCE_IPS.includes(input.sourceIp),
    };
  },
};

export type InitiateCardPaymentParams = {
  reference: string;
  amount: number;
  currency: "GHS";
  customerEmail: string;
  /** Server-generated from env.NEXT_PUBLIC_APP_URL — never a client-supplied or Host-header-derived value. */
  callbackUrl: string;
};

/**
 * Card payments (M10B) — deliberately NOT part of the shared
 * `PaymentProvider` interface, which is MoMo-shaped (network/phone/otpcode
 * have no card equivalent). This is the one place a Paystack-specific
 * function is called directly by modules/payments/service.ts; everything
 * downstream of initiation (webhook route, applyVerifyOutcome, Payment
 * table, PaystackRefundExecutor) is fully shared, unchanged, with MoMo.
 */
export async function initiatePaystackCardPayment(params: InitiateCardPaymentParams): Promise<InitiateCardPaymentOutcome> {
  const result = await paystackClient.initializeTransaction({
    email: params.customerEmail,
    amount: ghsToPesewas(params.amount),
    currency: params.currency,
    reference: params.reference,
    callback_url: params.callbackUrl,
    channels: ["card"],
  });

  if (!result.ok) {
    if (result.kind === "TIMEOUT" || result.kind === "NETWORK") {
      return { outcome: "UNKNOWN", reasonSafe: "Payment could not be started right now. Please try again shortly." };
    }
    return { outcome: "REJECTED", reasonSafe: "Payment could not be started. Please try again.", providerStatus: `HTTP_${result.status ?? "ERR"}` };
  }

  return mapInitializeResponse(result.data);
}
