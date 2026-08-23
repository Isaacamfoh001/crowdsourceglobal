import Link from "next/link";
import { notFound } from "next/navigation";
import { requireVendorFinanceContext } from "../../../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../../../lib/format";

export const metadata = { title: "Settlement — Vendor Portal" };
export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-espresso-900/50">{label}</span>
      <span className="text-right font-medium text-espresso-950">{value}</span>
    </div>
  );
}

function destinationLabel(destination: { type: string; momoPhoneMasked?: string | null; momoNetwork?: string | null; bankAccountNumber?: string | null; bankName?: string | null } | null): string {
  if (!destination) return "—";
  if (destination.type === "MOBILE_MONEY") return `${destination.momoNetwork ?? "Mobile Money"} — ${destination.momoPhoneMasked ?? "—"}`;
  return `${destination.bankName ?? "Bank"} — ${destination.bankAccountNumber ?? "—"}`;
}

/** FAILED never appears to the Vendor as "failed" — CrownSource is still resolving it (retry or manual fallback), so it reads the same as "still awaiting payout." */
function vendorStatusLabel(status: string): string {
  if (status === "PAID") return "Paid";
  if (status === "PROCESSING") return "Payout processing";
  if (status === "CANCELLED") return "Cancelled";
  return "Awaiting payout";
}

export default async function VendorSettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { vendorId } = await requireVendorFinanceContext("/vendor/portal/finance/settlements");
  const { id } = await params;

  const result = await vendorFinanceService.getSettlementDetailForVendor(vendorId, id);
  if (!result.ok) notFound();
  const settlement = result.value;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/vendor/portal/finance/settlements" className="text-sm text-espresso-900/50 hover:text-espresso-800">
          ← Settlement history
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-espresso-950">{settlement.settlementNumber}</h1>
      </div>

      <div className="rounded-2xl border border-ivory-300 bg-white p-6">
        <Field label="Status" value={vendorStatusLabel(settlement.status)} />
        <Field label="Gross" value={formatPrice(settlement.grossPayable, settlement.currency)} />
        {settlement.adjustmentTotal !== 0 ? <Field label="Adjustments" value={formatPrice(settlement.adjustmentTotal, settlement.currency)} /> : null}
        <Field label="Net amount" value={formatPrice(settlement.netAmount, settlement.currency)} />
        {settlement.payoutMethod ? <Field label="Paid via" value={destinationLabel(settlement.destination)} /> : null}
        {settlement.payoutExternalReference ? <Field label="Reference" value={settlement.payoutExternalReference} /> : null}
        {settlement.payoutPaidAt ? <Field label="Paid on" value={settlement.payoutPaidAt.toLocaleDateString()} /> : null}
      </div>

      <div className="rounded-2xl border border-ivory-300 bg-white p-6">
        <h2 className="font-display text-base font-medium text-espresso-950">Included orders</h2>
        <div className="mt-3 divide-y divide-ivory-100">
          {settlement.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
              <span className="text-espresso-900/65">Order {item.orderNumber}</span>
              <span className="font-medium text-espresso-950">{formatPrice(item.amount, settlement.currency)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
