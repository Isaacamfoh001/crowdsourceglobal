import Link from "next/link";
import { notFound } from "next/navigation";
import { requireVendorFinanceContext } from "../../../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../../../lib/format";

export const metadata = { title: "Earning — Vendor Portal" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending fulfilment",
  WAITING_PERIOD: "Settlement waiting period",
  ON_HOLD: "On hold",
  ELIGIBLE: "Eligible for settlement",
  INCLUDED_IN_SETTLEMENT: "Included in a settlement",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-espresso-900/50">{label}</span>
      <span className="text-right font-medium text-espresso-950">{value}</span>
    </div>
  );
}

export default async function VendorEarningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { vendorId } = await requireVendorFinanceContext("/vendor/portal/finance");
  const { id } = await params;

  const result = await vendorFinanceService.getEarningDetailForVendor(vendorId, id);
  if (!result.ok) notFound();
  const earning = result.value;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/vendor/portal/finance" className="text-sm text-espresso-900/50 hover:text-espresso-800">
          ← Finance
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-espresso-950">Order {earning.orderNumber}</h1>
        <p className="mt-1 text-sm text-espresso-900/50">{STATUS_LABEL[earning.status]}</p>
      </div>

      {earning.status === "ON_HOLD" && earning.holdReasonSafe ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800">
          <p className="font-medium">On hold</p>
          <p className="mt-1">{earning.holdReasonSafe}</p>
        </div>
      ) : null}

      <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-6">
        <Field label="Item" value={earning.orderItemDescription} />
        <Field label="Quantity" value={earning.quantity} />
        <Field label="Original amount" value={formatPrice(earning.originalPayableAmount, earning.currency)} />
        <Field label="Adjusted amount" value={formatPrice(earning.netAmount, earning.currency)} />
        <Field label="Fulfilment status" value={earning.fulfilmentStatus} />
        <Field label="Created" value={earning.createdAt.toLocaleDateString()} />
        {earning.eligibleAt ? <Field label="Became eligible" value={earning.eligibleAt.toLocaleDateString()} /> : null}
      </div>

      {earning.adjustments.length > 0 ? (
        <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-6">
          <h2 className="font-display text-base font-medium text-espresso-950">Adjustments</h2>
          <div className="mt-3 divide-y divide-ivory-100">
            {earning.adjustments.map((adjustment) => (
              <div key={adjustment.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="text-espresso-900/65">{adjustment.reason}</span>
                <span className={`font-medium ${adjustment.amount < 0 ? "text-danger-600" : "text-success-700"}`}>
                  {adjustment.amount < 0 ? "-" : "+"}
                  {formatPrice(Math.abs(adjustment.amount), earning.currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
