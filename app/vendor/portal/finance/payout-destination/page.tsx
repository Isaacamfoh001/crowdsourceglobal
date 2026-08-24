import Link from "next/link";
import { requireVendorFinanceContext, requireOwnerRole } from "../../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../../modules/vendor-finance/service";
import { PayoutDestinationForm } from "../../../../../components/vendor-portal/PayoutDestinationForm";

export const metadata = { title: "Payout details — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorPayoutDestinationPage() {
  const { vendorId, role } = await requireVendorFinanceContext("/vendor/portal/finance/payout-destination");
  const destination = await vendorFinanceService.getPayoutDestinationForVendor(vendorId);

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <Link href="/vendor/portal/finance" className="text-sm text-espresso-900/50 hover:text-espresso-800">
          ← Finance
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-espresso-950">Payout details</h1>
        <p className="mt-1 text-[15px] text-espresso-900/50">Where CrownSourceGlobal sends your settlement payouts.</p>
      </div>

      <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-6">
        {destination ? (
          <p className="mb-4 text-sm text-espresso-900/65">
            Currently:{" "}
            {destination.type === "MOBILE_MONEY"
              ? `${destination.momoNetwork ?? "Mobile Money"} — ${destination.momoPhoneMasked}`
              : `${destination.bankName} — ${destination.bankAccountNumberMasked}`}
          </p>
        ) : (
          <p className="mb-4 text-sm text-espresso-900/50">No payout details on file yet.</p>
        )}

        {requireOwnerRole(role) ? (
          <PayoutDestinationForm
            existing={
              destination
                ? {
                    type: destination.type,
                    momoAccountName: destination.momoAccountName,
                    momoNetwork: destination.momoNetwork,
                    bankAccountName: destination.bankAccountName,
                    bankName: destination.bankName,
                  }
                : null
            }
          />
        ) : (
          <p className="rounded-lg bg-ivory-50 p-4 text-sm text-espresso-900/65">Only the Vendor account owner can change payout details.</p>
        )}
      </div>
    </div>
  );
}
