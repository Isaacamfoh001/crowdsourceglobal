import Link from "next/link";
import { requireVendorFinanceContext } from "../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../lib/format";

export const metadata = { title: "Finance — Vendor Portal" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending fulfilment",
  WAITING_PERIOD: "Settlement waiting period",
  ON_HOLD: "On hold",
  ELIGIBLE: "Eligible",
  INCLUDED_IN_SETTLEMENT: "In settlement",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  WAITING_PERIOD: "bg-amber-100 text-amber-700",
  ON_HOLD: "bg-red-100 text-red-700",
  ELIGIBLE: "bg-emerald-100 text-emerald-700",
  INCLUDED_IN_SETTLEMENT: "bg-sky-100 text-sky-700",
  PAID: "bg-stone-200 text-stone-600",
  CANCELLED: "bg-stone-200 text-stone-500",
};

export default async function VendorFinancePage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { vendorId } = await requireVendorFinanceContext("/vendor/portal/finance");
  const { status, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const overview = await vendorFinanceService.getOverviewForVendor(vendorId);
  const { rows, total, pageSize } = await vendorFinanceService.listEarningsForVendor(vendorId, status, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">Finance</h1>
        <p className="mt-1 text-[15px] text-stone-500">Your earnings and settlements from CrownSourceGlobal.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Available for settlement</p>
          <p className="mt-1.5 font-display text-xl font-medium text-emerald-700">{formatPrice(overview.availableForSettlement, overview.currency)}</p>
          {overview.unappliedAdjustmentTotal < 0 ? (
            <p className="mt-1 text-xs text-red-600">Includes {formatPrice(overview.unappliedAdjustmentTotal, overview.currency)} outstanding adjustment</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Pending</p>
          <p className="mt-1.5 font-display text-xl font-medium text-stone-900">{formatPrice(overview.pending, overview.currency)}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Waiting period</p>
          <p className="mt-1.5 font-display text-xl font-medium text-amber-700">{formatPrice(overview.waitingPeriod, overview.currency)}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">On hold</p>
          <p className="mt-1.5 font-display text-xl font-medium text-red-700">{formatPrice(overview.onHold, overview.currency)}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Paid to date</p>
          <p className="mt-1.5 font-display text-xl font-medium text-stone-900">{formatPrice(overview.paidToDate, overview.currency)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[undefined, "PENDING", "WAITING_PERIOD", "ON_HOLD", "ELIGIBLE", "PAID"].map((value) => (
            <Link
              key={value ?? "all"}
              href={value ? `/vendor/portal/finance?status=${value}` : "/vendor/portal/finance"}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                status === value ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-stone-700"
              }`}
            >
              {value ? STATUS_LABEL[value] : "All"}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href="/vendor/portal/finance/settlements" className="text-sm font-medium text-brand-700 hover:underline">
            Settlement history
          </Link>
          <span className="text-stone-300">·</span>
          <Link href="/vendor/portal/finance/payout-destination" className="text-sm font-medium text-brand-700 hover:underline">
            Payout details
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No earnings here yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {rows.map((earning) => (
            <Link
              key={earning.id}
              href={`/vendor/portal/finance/earnings/${earning.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">Order {earning.orderNumber}</p>
                {earning.holdReasonSafe ? <p className="text-xs text-red-600">{earning.holdReasonSafe}</p> : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-stone-900">{formatPrice(earning.netAmount, earning.currency)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[earning.status]}`}>{STATUS_LABEL[earning.status]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > pageSize ? (
        <div className="flex justify-center gap-2">
          {currentPage > 1 ? (
            <Link href={`/vendor/portal/finance?${status ? `status=${status}&` : ""}page=${currentPage - 1}`} className="text-sm font-medium text-brand-700 hover:underline">
              ← Previous
            </Link>
          ) : null}
          {currentPage * pageSize < total ? (
            <Link href={`/vendor/portal/finance?${status ? `status=${status}&` : ""}page=${currentPage + 1}`} className="text-sm font-medium text-brand-700 hover:underline">
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
