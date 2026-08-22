import { env } from "../../../../lib/env";
import type {
  PaystackBankListResponse,
  PaystackChargeResponse,
  PaystackInitializeResponse,
  PaystackRecipientType,
  PaystackRefundResponse,
  PaystackTransferResponse,
  PaystackTransferRecipientResponse,
  PaystackVerifyResponse,
} from "./types";

const BASE_URL = "https://api.paystack.co";
const TIMEOUT_MS = 15_000;

export type PaystackHttpResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "TIMEOUT" | "NETWORK" | "HTTP_ERROR" | "PARSE_ERROR"; status?: number; raw?: unknown };

/**
 * Owns HTTPS transport, Bearer auth (secret key), timeouts, and raw
 * response parsing only — no CrownSourceGlobal domain concepts, no outcome
 * interpretation (see status-map.ts). Every call is explicitly timed out;
 * a timeout is surfaced distinctly from a network failure or an HTTP
 * error, never silently treated as either success or failure.
 */
async function paystackRequest<T>(path: string, method: "GET" | "POST", body?: Record<string, unknown>): Promise<PaystackHttpResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, kind: "PARSE_ERROR", status: res.status };
    }

    if (!res.ok) {
      return { ok: false, kind: "HTTP_ERROR", status: res.status, raw: json };
    }
    return { ok: true, data: json as T };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, kind: "TIMEOUT" };
    }
    return { ok: false, kind: "NETWORK" };
  } finally {
    clearTimeout(timeout);
  }
}

export const paystackClient = {
  createCharge(body: {
    email: string;
    amount: number;
    currency: "GHS";
    reference: string;
    mobile_money: { phone: string; provider: string };
  }) {
    return paystackRequest<PaystackChargeResponse>("/charge", "POST", body);
  },
  submitOtp(body: { otp: string; reference: string }) {
    return paystackRequest<PaystackChargeResponse>("/charge/submit_otp", "POST", body);
  },
  checkPendingCharge(reference: string) {
    return paystackRequest<PaystackChargeResponse>(`/charge/${encodeURIComponent(reference)}`, "GET");
  },
  /**
   * Card payments (M10B) — Paystack-hosted Checkout. We only ever send
   * amount/currency/email/reference/callback_url/channels; the customer
   * enters PAN/CVV/PIN/OTP exclusively on Paystack's own hosted page,
   * which never touches CrownSourceGlobal's server.
   */
  initializeTransaction(body: { email: string; amount: number; currency: "GHS"; reference: string; callback_url: string; channels: string[] }) {
    return paystackRequest<PaystackInitializeResponse>("/transaction/initialize", "POST", body);
  },
  verifyTransaction(reference: string) {
    return paystackRequest<PaystackVerifyResponse>(`/transaction/verify/${encodeURIComponent(reference)}`, "GET");
  },
  createRefund(body: { transaction: string; amount?: number; currency?: "GHS"; customer_note?: string; merchant_note?: string }) {
    return paystackRequest<PaystackRefundResponse>("/refund", "POST", body);
  },
  fetchRefund(reference: string) {
    return paystackRequest<PaystackRefundResponse>(`/refund/${encodeURIComponent(reference)}`, "GET");
  },

  /**
   * Vendor payouts (M12). GET /bank resolves the bank_code a Transfer
   * Recipient needs — this is a DIFFERENT code space from the Charge API's
   * mobile_money.provider strings (mtn/atl/vod) used for customer payments;
   * never conflate the two. `type` narrows to Ghana mobile money wallets vs
   * GhIPSS bank accounts.
   */
  listBanks(params: { country: "ghana"; currency: "GHS"; type?: PaystackRecipientType }) {
    const qs = new URLSearchParams({ country: params.country, currency: params.currency });
    if (params.type) qs.set("type", params.type);
    return paystackRequest<PaystackBankListResponse>(`/bank?${qs.toString()}`, "GET");
  },
  createTransferRecipient(body: { type: PaystackRecipientType; name: string; account_number: string; bank_code: string; currency: "GHS" }) {
    return paystackRequest<PaystackTransferRecipientResponse>("/transferrecipient", "POST", body);
  },
  initiateTransfer(body: { source: "balance"; amount: number; recipient: string; reason: string; currency: "GHS"; reference: string }) {
    return paystackRequest<PaystackTransferResponse>("/transfer", "POST", body);
  },
  verifyTransfer(reference: string) {
    return paystackRequest<PaystackTransferResponse>(`/transfer/verify/${encodeURIComponent(reference)}`, "GET");
  },
};
