import { paystackClient } from "../payments/providers/paystack/client";
import { resolveGhipssBankCode, resolveMomoBankCode } from "../payments/providers/paystack/bank-codes";
import { ghsToPesewas } from "../../lib/money";
import { normalizeGhanaPhone } from "../../lib/phone";
import type { InitiatePayoutParams, PayoutProvider, PayoutStatusOutcome, ResolveRecipientParams } from "./payout-provider";

/**
 * Maps Paystack's documented Transfer status values (see
 * docs/decisions/0010-paystack-vendor-payouts.md) to the shared
 * PayoutStatusOutcome. "otp" means the Paystack account has the Transfers
 * OTP requirement enabled — this integration has no OTP-entry step (the
 * brief's own UX rule: one click, no multi-step provider console), so it is
 * treated as a definitive FAILED with a diagnostic Admin can act on
 * (disable OTP for API transfers in Paystack settings), never left
 * dangling as PROCESSING. "reversed" — a transfer that had already
 * succeeded and was later reversed by the receiving bank — is treated as
 * FAILED here too; if it arrives after this settlement already reached
 * PAID, the caller (vendorFinanceService) never silently un-pays it, only
 * flags it for manual review.
 */
function mapTransferStatus(status: string, transferCode: string | null, reference: string | null): PayoutStatusOutcome {
  switch (status) {
    case "success":
      return { status: "PAID", providerReference: reference ?? transferCode ?? "", transferCode };
    case "pending":
    case "queued":
      return { status: "PROCESSING", transferCode };
    case "otp":
      return { status: "FAILED", reasonSafe: "Paystack requires OTP confirmation for this transfer. Ask Isaac to disable the Transfers OTP requirement for API-initiated transfers in the Paystack dashboard." };
    case "failed":
      return { status: "FAILED", reasonSafe: "Paystack reported this transfer as failed." };
    case "reversed":
      return { status: "FAILED", reasonSafe: "Paystack reversed this transfer." };
    default:
      return { status: "PROCESSING", transferCode };
  }
}

export const paystackPayoutProvider: PayoutProvider = {
  name: "PAYSTACK",

  async resolveRecipient(params: ResolveRecipientParams) {
    const { destination, vendorName } = params;

    if (destination.type === "MOBILE_MONEY") {
      if (!destination.momoPhone || !destination.momoNetwork) return { ok: false, error: "This vendor's Mobile Money destination is incomplete." };
      const normalizedPhone = normalizeGhanaPhone(destination.momoPhone);
      if (!normalizedPhone) return { ok: false, error: "This vendor's Mobile Money phone number is invalid." };
      const bankCode = await resolveMomoBankCode(destination.momoNetwork as "MTN" | "TELECEL" | "AT");
      if (!bankCode.ok) return { ok: false, error: bankCode.error };

      const result = await paystackClient.createTransferRecipient({
        type: "mobile_money",
        name: destination.momoAccountName || vendorName,
        account_number: normalizedPhone,
        bank_code: bankCode.value,
        currency: "GHS",
      });
      if (!result.ok) return { ok: false, error: "Paystack rejected this vendor's Mobile Money payout details." };
      return { ok: true, value: result.data.data.recipient_code };
    }

    if (!destination.bankAccountNumber || !destination.bankName) return { ok: false, error: "This vendor's bank destination is incomplete." };
    const bankCode = await resolveGhipssBankCode(destination.bankName);
    if (!bankCode.ok) return { ok: false, error: bankCode.error };

    const result = await paystackClient.createTransferRecipient({
      type: "ghipss",
      name: destination.bankAccountName || vendorName,
      account_number: destination.bankAccountNumber,
      bank_code: bankCode.value,
      currency: "GHS",
    });
    if (!result.ok) return { ok: false, error: "Paystack rejected this vendor's bank payout details." };
    return { ok: true, value: result.data.data.recipient_code };
  },

  async initiate(params: InitiatePayoutParams): Promise<PayoutStatusOutcome> {
    const result = await paystackClient.initiateTransfer({
      source: "balance",
      amount: ghsToPesewas(params.amount),
      recipient: params.recipientCode,
      reason: params.reason,
      currency: params.currency,
      reference: params.reference,
    });

    if (!result.ok) {
    
      if (result.kind === "TIMEOUT" || result.kind === "NETWORK") {
        // Genuinely uncertain whether Paystack received/created the
        // transfer — never retry blindly (could double-pay). Resolved
        // later via verify().
        return { status: "UNKNOWN" };
      }
     
      return { status: "FAILED",
        reasonSafe: "Automated Vendor payouts aren't enabled for this Paystack business Upgrade the Paystack account to a Registered Business to use Paystack payouts." };
    }

    return mapTransferStatus(result.data.data.status, result.data.data.transfer_code, result.data.data.reference ?? params.reference);
  },

  async verify(reference: string): Promise<PayoutStatusOutcome> {
    const result = await paystackClient.verifyTransfer(reference);
    if (!result.ok) return { status: "UNKNOWN" };
    return mapTransferStatus(result.data.data.status, result.data.data.transfer_code, result.data.data.reference ?? reference);
  },
};
