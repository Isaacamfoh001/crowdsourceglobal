import Link from "next/link";
import { requireVendorFinanceContext } from "../../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../../lib/format";

export const metadata = { title: "Settlement history — Vendor Portal" };
export const dynamic = "force-dynamic";

/**
 * Vendor-facing labels are deliberately simpler than the internal
 * SettlementStatus enum — FAILED never appears here (it means "CrownSource
 * is still working this out", not something the Vendor needs to act on or
 * worry about); it reads the same as DRAFT/APPROVED, "Awaiting payout".
 */
const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Awaiting payout",
  APPROVED: "Awaiting payout",
  PROCESSING: "Payout processing",
  PAID: "Paid",
  FAILED: "Awaiting payout",
  CANCELLED: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-ivory-300 text-espresso-900/65",
  APPROVED: "bg-warning-100 text-warning-700",
  PROCESSING: "bg-warning-100 text-warning-700",
  PAID: "bg-success-100 text-success-700",
  FAILED: "bg-ivory-300 text-espresso-900/65",
  CANCELLED: "bg-ivory-300 text-espresso-900/50",
};

export default async function VendorSettlementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { vendorId } = await requireVendorFinanceContext("/vendor/portal/finance/settlements");
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const { rows, total, pageSize } = await vendorFinanceService.listSettlementsForVendor(vendorId, undefined, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/vendor/portal/finance" className="text-sm text-espresso-900/50 hover:text-espresso-800">
          ← Finance
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-espresso-950">Settlement history</h1>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ivory-400 bg-white p-10 text-center">
          <p className="text-sm text-espresso-900/50">No settlements yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-ivory-100 rounded-2xl border border-ivory-300 bg-white">
          {rows.map((settlement) => (
            <Link
              key={settlement.id}
              href={`/vendor/portal/finance/settlements/${settlement.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">{settlement.settlementNumber}</p>
                <p className="text-xs text-espresso-900/50">{settlement.createdAt.toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-espresso-950">{formatPrice(settlement.netAmount, settlement.currency)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[settlement.status]}`}>{STATUS_LABEL[settlement.status]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > pageSize ? (
        <div className="flex justify-center gap-2">
          {currentPage > 1 ? (
            <Link href={`/vendor/portal/finance/settlements?page=${currentPage - 1}`} className="text-sm font-medium text-forest-800 hover:underline">
              ← Previous
            </Link>
          ) : null}
          {currentPage * pageSize < total ? (
            <Link href={`/vendor/portal/finance/settlements?page=${currentPage + 1}`} className="text-sm font-medium text-forest-800 hover:underline">
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
