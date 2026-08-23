import Link from "next/link";
import { requireAdminFinanceView } from "../../../../../modules/vendor-finance/policy";
import { vendorFinanceService } from "../../../../../modules/vendor-finance/service";
import { formatPrice } from "../../../../../lib/format";

export const metadata = { title: "Settlements — Admin" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "APPROVED", label: "Approved" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-ivory-300 text-espresso-900/65",
  APPROVED: "bg-warning-100 text-warning-700",
  PROCESSING: "bg-warning-100 text-warning-700",
  PAID: "bg-success-100 text-success-700",
  FAILED: "bg-danger-100 text-danger-700",
  CANCELLED: "bg-ivory-300 text-espresso-900/50",
};

export default async function AdminSettlementsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdminFinanceView("/admin/finance");
  const { status, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const { rows, total, pageSize } = await vendorFinanceService.listSettlementsForAdmin({ status }, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/finance" className="text-sm text-espresso-900/50 hover:text-espresso-800">
          ← Finance
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-espresso-950">Settlements</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/finance/settlements?status=${filter.value}` : "/admin/finance/settlements"}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              status === filter.value ? "bg-forest-800 text-white" : "bg-white text-espresso-900/65 ring-1 ring-ivory-300 hover:bg-ivory-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ivory-400 bg-white p-10 text-center">
          <p className="text-sm text-espresso-900/50">No settlements found.</p>
        </div>
      ) : (
        <div className="divide-y divide-ivory-100 rounded-2xl border border-ivory-300 bg-white">
          {rows.map((s) => (
            <Link key={s.id} href={`/admin/finance/settlements/${s.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-espresso-950">{s.settlementNumber}</p>
                <p className="text-xs text-espresso-900/50">{s.vendorName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-espresso-950">{formatPrice(s.netAmount, s.currency)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[s.status] ?? "bg-ivory-300 text-espresso-900/65"}`}>{s.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > pageSize ? (
        <div className="flex justify-center gap-2">
          {currentPage > 1 ? (
            <Link href={`/admin/finance/settlements?${status ? `status=${status}&` : ""}page=${currentPage - 1}`} className="text-sm font-medium text-forest-800 hover:underline">
              ← Previous
            </Link>
          ) : null}
          {currentPage * pageSize < total ? (
            <Link href={`/admin/finance/settlements?${status ? `status=${status}&` : ""}page=${currentPage + 1}`} className="text-sm font-medium text-forest-800 hover:underline">
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
