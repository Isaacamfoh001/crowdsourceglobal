"use server";

import { revalidatePath } from "next/cache";
import { requireVendorFinanceContext } from "../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../modules/vendor-finance/service";
import type { PayoutDestinationInput } from "../../modules/vendor-finance/types";
import { err, type Result } from "../result";

export async function upsertPayoutDestinationAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session, vendorId, role } = await requireVendorFinanceContext("/vendor/portal/finance/payout-destination");

  const type = String(formData.get("type") ?? "");
  let input: PayoutDestinationInput;
  if (type === "MOBILE_MONEY") {
    input = {
      type: "MOBILE_MONEY",
      momoAccountName: String(formData.get("momoAccountName") ?? ""),
      momoPhone: String(formData.get("momoPhone") ?? ""),
      momoNetwork: String(formData.get("momoNetwork") ?? "") as "MTN" | "TELECEL" | "AT",
    };
  } else if (type === "BANK_TRANSFER") {
    input = {
      type: "BANK_TRANSFER",
      bankAccountName: String(formData.get("bankAccountName") ?? ""),
      bankName: String(formData.get("bankName") ?? ""),
      bankAccountNumber: String(formData.get("bankAccountNumber") ?? ""),
    };
  } else {
    return err("Choose a payout method.");
  }

  const result = await vendorFinanceService.upsertPayoutDestinationForVendor(vendorId, role, session.user.id, input);
  if (!result.ok) return result;

  revalidatePath("/vendor/portal/finance/payout-destination");
  return result;
}
