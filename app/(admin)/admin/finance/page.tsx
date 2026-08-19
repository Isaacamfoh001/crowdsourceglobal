import Link from "next/link";
import { requireAdminFinanceView } from "../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../lib/format";

export const metadata = { title: "Finance — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  await requireAdminFinanceView("/admin/finance");
  const vendors = await vendorFinanceService.listVendorFinanceForAdmin();

  const totals = vendors.reduce(
    (acc, v) => ({
      eligible: acc.eligible + v.eligible,
      pending: acc.pending + v.pending,
      waitingPeriod: acc.waitingPeriod + v.waitingPeriod,
      onHold: acc.onHold + v.onHold,
    }),
    { eligible: 0, pending: 0, waitingPeriod: 0, onHold: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-medium text-stone-900">Finance</h1>
        <Link href="/admin/finance/settlements" className="text-sm font-medium text-brand-700 hover:underline">
          All settlements →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Vendor payable — eligible</p>
          <p className="mt-1.5 font-display text-xl font-medium text-emerald-700">{formatPrice(totals.eligible, "GHS")}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Vendor payable — pending</p>
          <p className="mt-1.5 font-display text-xl font-medium text-stone-900">{formatPrice(totals.pending, "GHS")}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Vendor payable — waiting period</p>
          <p className="mt-1.5 font-display text-xl font-medium text-amber-700">{formatPrice(totals.waitingPeriod, "GHS")}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Vendor payable — on hold</p>
          <p className="mt-1.5 font-display text-xl font-medium text-red-700">{formatPrice(totals.onHold, "GHS")}</p>
        </div>
      </div>

      <h2 className="font-display text-base font-medium text-stone-900">Vendor payables</h2>
      {vendors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No outstanding vendor payables.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {vendors.map((v) => (
            <Link key={v.vendorId} href={`/admin/finance/vendors/${v.vendorId}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-stone-900">{v.vendorName}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
                <span>
                  Eligible <span className="font-medium text-emerald-700">{formatPrice(v.eligible, v.currency)}</span>
                </span>
                <span>
                  Pending <span className="font-medium text-stone-700">{formatPrice(v.pending, v.currency)}</span>
                </span>
                {v.waitingPeriod > 0 ? (
                  <span>
                    Waiting period <span className="font-medium text-amber-700">{formatPrice(v.waitingPeriod, v.currency)}</span>
                  </span>
                ) : null}
                {v.onHold > 0 ? (
                  <span>
                    On hold <span className="font-medium text-red-700">{formatPrice(v.onHold, v.currency)}</span>
                  </span>
                ) : null}
                {v.unappliedAdjustmentTotal !== 0 ? (
                  <span>
                    Adjustments <span className={`font-medium ${v.unappliedAdjustmentTotal < 0 ? "text-red-700" : "text-emerald-700"}`}>{formatPrice(v.unappliedAdjustmentTotal, v.currency)}</span>
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
