import Link from "next/link";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Card } from "../../../../components/ui/Card";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { Pagination } from "../../../../components/shared/Pagination";
import { parsePage } from "../../../../lib/pagination";
import { requireVendorFinanceContext } from "../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../lib/format";
import type { BadgeTone } from "../../../../components/ui/Badge";

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

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  WAITING_PERIOD: "warning",
  ON_HOLD: "danger",
  ELIGIBLE: "success",
  INCLUDED_IN_SETTLEMENT: "info",
  PAID: "neutral",
  CANCELLED: "neutral",
};

export default async function VendorFinancePage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { vendorId } = await requireVendorFinanceContext("/vendor/portal/finance");
  const { status, page } = await searchParams;
  const currentPage = parsePage(page);

  const overview = await vendorFinanceService.getOverviewForVendor(vendorId);
  const { rows, total, pageSize } = await vendorFinanceService.listEarningsForVendor(vendorId, status, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Finance" description="Your earnings and settlements from CrownSourceGlobal." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="!p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-espresso-900/50">Available for settlement</p>
          <p className="mt-1.5 font-display text-xl font-medium text-success-700">{formatPrice(overview.availableForSettlement, overview.currency)}</p>
          {overview.unappliedAdjustmentTotal < 0 ? (
            <p className="mt-1 text-xs text-danger-600">Includes {formatPrice(overview.unappliedAdjustmentTotal, overview.currency)} outstanding adjustment</p>
          ) : null}
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-espresso-900/50">Pending</p>
          <p className="mt-1.5 font-display text-xl font-medium text-espresso-950">{formatPrice(overview.pending, overview.currency)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-espresso-900/50">Waiting period</p>
          <p className="mt-1.5 font-display text-xl font-medium text-warning-700">{formatPrice(overview.waitingPeriod, overview.currency)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-espresso-900/50">On hold</p>
          <p className="mt-1.5 font-display text-xl font-medium text-danger-700">{formatPrice(overview.onHold, overview.currency)}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-espresso-900/50">Paid to date</p>
          <p className="mt-1.5 font-display text-xl font-medium text-espresso-950">{formatPrice(overview.paidToDate, overview.currency)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[undefined, "PENDING", "WAITING_PERIOD", "ON_HOLD", "ELIGIBLE", "PAID"].map((value) => (
            <Link
              key={value ?? "all"}
              href={value ? `/vendor/portal/finance?status=${value}` : "/vendor/portal/finance"}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                status === value ? "border-espresso-800 bg-espresso-800 text-white" : "border-ivory-400 bg-ivory-50 text-espresso-800"
              }`}
            >
              {value ? STATUS_LABEL[value] : "All"}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          <Link href="/vendor/portal/finance/settlements" className="text-sm font-medium text-espresso-800 hover:underline">
            Settlement history
          </Link>
          <span className="text-ivory-400">·</span>
          <Link href="/vendor/portal/finance/payout-destination" className="text-sm font-medium text-espresso-800 hover:underline">
            Payout details
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No earnings here yet" description="Earnings matching this filter will show up here." />
      ) : (
        <Card as="div" padded={false} className="divide-y divide-ivory-100">
          {rows.map((earning) => (
            <Link
              key={earning.id}
              href={`/vendor/portal/finance/earnings/${earning.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">Order {earning.orderNumber}</p>
                {earning.holdReasonSafe ? <p className="text-xs text-danger-600">{earning.holdReasonSafe}</p> : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-espresso-950">{formatPrice(earning.netAmount, earning.currency)}</span>
                <StatusBadge tone={STATUS_TONE[earning.status]}>{STATUS_LABEL[earning.status]}</StatusBadge>
              </div>
            </Link>
          ))}
        </Card>
      )}

      <Pagination
        currentPage={currentPage}
        total={total}
        pageSize={pageSize}
        basePath="/vendor/portal/finance"
        extraParams={{ status }}
      />
    </div>
  );
}
