import { env } from "../../../../lib/env";
import type {
  InitiatePaymentOutcome,
  InitiatePaymentParams,
  PaymentProvider,
  VerifyPaymentOutcome,
  VerifyPaymentParams,
  WebhookParseResult,
} from "../../provider";
import { moolreClient, type MoolreHttpResult } from "./client";
import { mapInitiateResponse, mapStatusResponse } from "./status-map";
import { MOOLRE_CALLBACK_SOURCE_IPS, MOOLRE_CHANNEL_CODES, type MoolreInitiateResponse, type MoolreStatusResponse, type MoolreWebhookPayload } from "./types";

/**
 * SANDBOX-ONLY diagnostics (never emitted when MOOLRE_ENV=production) to
 * see exactly what Moolre returned and how the adapter mapped it — added
 * to debug the real-sandbox OTP path, where Moolre's documentation doesn't
 * publish the post-OTP response code (see docs/decisions/0006). Logs only
 * the provider's own envelope fields (status/code/message) plus our mapped
 * outcome — never the request body, credentials, phone, or OTP value.
 */
function logMoolreDiagnostic(
  context: "initiate" | "otp_resubmit" | "verify",
  reference: string,
  result: MoolreHttpResult<MoolreInitiateResponse> | MoolreHttpResult<MoolreStatusResponse>,
  mappedOutcome: string,
): void {
  if (env.MOOLRE_ENV !== "sandbox") return;

  if (!result.ok) {
    console.log(
      JSON.stringify({
        scope: "moolre_diagnostic",
        context,
        reference,
        httpParsed: false,
        httpKind: result.kind,
        httpStatus: result.status ?? null,
        mappedOutcome,
        ts: new Date().toISOString(),
      }),
    );
    return;
  }

  const data = result.data as Partial<MoolreInitiateResponse & MoolreStatusResponse>;
  const txstatus = data.data && typeof data.data === "object" ? (data.data as { txstatus?: number }).txstatus ?? null : null;

  console.log(
    JSON.stringify({
      scope: "moolre_diagnostic",
      context,
      reference,
      httpParsed: true,
      providerStatus: data.status ?? null,
      providerCode: data.code ?? null,
      providerMessage: data.message ?? null,
      txstatus,
      mappedOutcome,
      ts: new Date().toISOString(),
    }),
  );
}

/**
 * Translates CrownSourceGlobal's provider-neutral requests into Moolre's
 * documented wire format and back. This is the only place Moolre channel
 * codes, headers, or field names are assembled.
 */
export const moolrePaymentProvider: PaymentProvider = {
  name: "MOOLRE",

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentOutcome> {
    const result = await moolreClient.initiatePayment({
      type: 1,
      channel: MOOLRE_CHANNEL_CODES[params.network],
      currency: params.currency,
      payer: params.phone,
      amount: params.amount.toFixed(2),
      externalref: params.reference,
      accountnumber: env.MOOLRE_ACCOUNT_NUMBER ?? "",
      ...(params.otpcode ? { otpcode: params.otpcode } : {}),
    });

    const context = params.otpcode ? "otp_resubmit" : "initiate";

    if (!result.ok) {
      const outcome: InitiatePaymentOutcome =
        result.kind === "TIMEOUT" || result.kind === "NETWORK"
          ? { outcome: "UNKNOWN", reasonSafe: "Payment is still processing. Please check status shortly." }
          : { outcome: "REJECTED", reasonSafe: "Payment could not be started. Please try again.", providerStatus: `HTTP_${result.status ?? "ERR"}` };
      logMoolreDiagnostic(context, params.reference, result, outcome.outcome);
      return outcome;
    }

    const outcome = mapInitiateResponse(result.data);
    logMoolreDiagnostic(context, params.reference, result, outcome.outcome);
    return outcome;
  },

  async verify(params: VerifyPaymentParams): Promise<VerifyPaymentOutcome> {
    const result = await moolreClient.getStatus({
      type: 1,
      idtype: 1,
      id: params.reference,
      accountnumber: env.MOOLRE_ACCOUNT_NUMBER ?? "",
    });

    if (!result.ok) {
      logMoolreDiagnostic("verify", params.reference, result, "UNKNOWN");
      return { status: "UNKNOWN", reasonSafe: "Could not verify payment status right now." };
    }

    const outcome = mapStatusResponse(result.data);
    logMoolreDiagnostic("verify", params.reference, result, outcome.status);
    return outcome;
  },

  parseWebhook(input: { body: unknown; sourceIp: string | null }): WebhookParseResult {
    const sourceIpTrusted = input.sourceIp !== null && MOOLRE_CALLBACK_SOURCE_IPS.includes(input.sourceIp);

    if (typeof input.body !== "object" || input.body === null) {
      return { recognized: false };
    }
    const payload = input.body as MoolreWebhookPayload;
    const reference = typeof payload.data?.externalref === "string" ? payload.data.externalref : null;
    const providerReference = typeof payload.data?.transactionid === "string" ? payload.data.transactionid : null;

    if (!reference && !providerReference) {
      return { recognized: false };
    }

    return {
      recognized: true,
      reference,
      providerReference,
      claimedSucceeded: Number(payload.status) === 1,
      sourceIpTrusted,
    };
  },
};
