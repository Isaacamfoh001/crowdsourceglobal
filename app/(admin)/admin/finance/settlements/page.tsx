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
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export default async function AdminSettlementsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdminFinanceView("/admin/finance");
  const { status, page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const { rows, total, pageSize } = await vendorFinanceService.listSettlementsForAdmin({ status }, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/finance" className="text-sm text-stone-500 hover:text-stone-700">
          ← Finance
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-stone-900">Settlements</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/finance/settlements?status=${filter.value}` : "/admin/finance/settlements"}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              status === filter.value ? "bg-brand-700 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No settlements found.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {rows.map((s) => (
            <Link key={s.id} href={`/admin/finance/settlements/${s.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-stone-900">{s.settlementNumber}</p>
                <p className="text-xs text-stone-500">{s.vendorName}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-stone-900">{formatPrice(s.netAmount, s.currency)}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    s.status === "PAID" ? "bg-emerald-100 text-emerald-700" : s.status === "APPROVED" ? "bg-amber-100 text-amber-700" : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {s.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {total > pageSize ? (
        <div className="flex justify-center gap-2">
          {currentPage > 1 ? (
            <Link href={`/admin/finance/settlements?${status ? `status=${status}&` : ""}page=${currentPage - 1}`} className="text-sm font-medium text-brand-700 hover:underline">
              ← Previous
            </Link>
          ) : null}
          {currentPage * pageSize < total ? (
            <Link href={`/admin/finance/settlements?${status ? `status=${status}&` : ""}page=${currentPage + 1}`} className="text-sm font-medium text-brand-700 hover:underline">
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
