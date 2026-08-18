import type { InitiatePaymentOutcome, VerifyPaymentOutcome } from "../../provider";
import type { MoolreInitiateResponse, MoolreStatusResponse } from "./types";

/**
 * Maps Moolre's documented response codes to our closed outcome unions.
 * Provider terminology never leaves this file. Honest, sourced mapping —
 * codes not covered here (see docs/decisions/0006 for the full list found)
 * fall back to a safe, non-committal outcome rather than a guessed one.
 */
export function mapInitiateResponse(res: MoolreInitiateResponse): InitiatePaymentOutcome {
  if (res.code === "TR099") {
    return { outcome: "ACCEPTED", providerReference: typeof res.data === "string" ? res.data : null, providerStatus: res.code };
  }
  if (res.code === "TP14") {
    return { outcome: "OTP_REQUIRED", providerStatus: res.code };
  }
  if (res.code === "TP17") {
    // "Phone no. Verification Successful." — confirms the OTP/phone
    // verification step only, NOT that money has been collected. ACCEPTED
    // already means "provider accepted the request; verify/poll status
    // next" (see TR099 above), which is exactly this case — no new outcome
    // needed. Never treated as a success signal by itself.
    //
    // providerReference is deliberately always null here — empirically
    // confirmed (real sandbox DB inspection, not assumed) that TP17's
    // `data` field is a non-unique placeholder string ("all"), exactly
    // like TP14's documented "data":"all" — NOT a genuine per-transaction
    // identifier. Treating it as one caused a real unique-constraint
    // collision across unrelated Orders. The genuine transaction id is
    // only trustworthy from TR099's `data` field or the status-
    // verification endpoint's `transactionid` field (see mapStatusResponse).
    return { outcome: "ACCEPTED", providerReference: null, providerStatus: res.code };
  }
  if (res.code === "TP13") {
    return {
      outcome: "REJECTED",
      reasonSafe: "This payment attempt could not be started. Please try again.",
      providerStatus: res.code,
    };
  }
  return {
    outcome: "REJECTED",
    reasonSafe: "Payment could not be started.",
    providerStatus: res.code || "UNKNOWN",
  };
}

/**
 * Only `code === "SS01"` with `data.txstatus === 1` was confirmed from
 * fetchable Moolre documentation as a definitive success signal. No full
 * enum of pending/failed status codes was found — rather than invent one,
 * any other recognized-but-inconclusive response is mapped to PENDING, never
 * FAILED. This is a deliberate safety choice: a wrongly-assumed FAILED could
 * cause a customer's genuinely-processing payment to be treated as dead,
 * while PENDING only delays resolution (via reconciliation/polling), never
 * falsely confirms or falsely kills a payment. Flagged as an open item for
 * Isaac to confirm with Moolre support before go-live.
 */
export function mapStatusResponse(res: MoolreStatusResponse): VerifyPaymentOutcome {
  if (res.code === "SS01" && res.data && res.data.txstatus === 1) {
    return {
      status: "SUCCEEDED",
      providerReference: res.data.transactionid,
      verifiedAmount: Number(res.data.amount),
      verifiedCurrency: "GHS",
      providerStatus: res.code,
    };
  }
  if (res.code === "ST09") {
    // "Transaction not Found" — the provider has no record of this reference.
    return { status: "UNKNOWN", reasonSafe: "Payment reference not yet recognized by the provider." };
  }
  return { status: "PENDING", providerStatus: res.code || "UNKNOWN" };
}
