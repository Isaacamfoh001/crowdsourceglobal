import Link from "next/link";
import { requireVendorFinanceContext } from "../../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../../lib/format";

export const metadata = { title: "Settlement history — Vendor Portal" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved — awaiting payout",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-stone-200 text-stone-600",
  APPROVED: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-stone-200 text-stone-500",
};

export default async function VendorSettlementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { vendorId } = await requireVendorFinanceContext("/vendor/portal/finance/settlements");
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const { rows, total, pageSize } = await vendorFinanceService.listSettlementsForVendor(vendorId, undefined, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/vendor/portal/finance" className="text-sm text-stone-500 hover:text-stone-700">
          ← Finance
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-stone-900">Settlement history</h1>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No settlements yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {rows.map((settlement) => (
            <Link
              key={settlement.id}
              href={`/vendor/portal/finance/settlements/${settlement.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{settlement.settlementNumber}</p>
                <p className="text-xs text-stone-500">{settlement.createdAt.toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-stone-900">{formatPrice(settlement.netAmount, settlement.currency)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[settlement.status]}`}>{STATUS_LABEL[settlement.status]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > pageSize ? (
        <div className="flex justify-center gap-2">
          {currentPage > 1 ? (
            <Link href={`/vendor/portal/finance/settlements?page=${currentPage - 1}`} className="text-sm font-medium text-brand-700 hover:underline">
              ← Previous
            </Link>
          ) : null}
          {currentPage * pageSize < total ? (
            <Link href={`/vendor/portal/finance/settlements?page=${currentPage + 1}`} className="text-sm font-medium text-brand-700 hover:underline">
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
