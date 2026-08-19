import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { quotationService } from "../../../../modules/quotation/service";
import { QuoteStatusBadge } from "../../../../components/quotation/QuoteStatusBadge";
import { formatPrice } from "../../../../lib/format";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";

export const metadata = { title: "Quotations — Admin" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "ISSUED" as const, label: "Active" },
  { value: "ACCEPTED" as const, label: "Accepted" },
  { value: "EXPIRED" as const, label: "Expired" },
];

export default async function AdminQuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdminSession("/admin/quotations");
  const { status, page } = await searchParams;
  const activeStatus = status === "ISSUED" || status === "ACCEPTED" || status === "EXPIRED" ? status : undefined;
  const currentPage = parsePage(page);

  const { rows: quotes, total, pageSize } = await quotationService.listForAdminPaginated(activeStatus, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-stone-900">Quotations</h1>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/quotations?status=${filter.value}` : "/admin/quotations"}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeStatus === filter.value
                ? "bg-brand-700 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No quotations found.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {quotes.map((quote) => (
            <Link
              key={quote.id}
              href={`/admin/quotations/${quote.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{quote.reference}</p>
                <p className="text-xs text-stone-500">
                  {quote.customerName} ({quote.customerEmail}) ·{" "}
                  {quote.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·
                  expires{" "}
                  {quote.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <QuoteStatusBadge status={quote.status} />
                <span className="text-sm font-semibold text-stone-900">
                  {formatPrice(quote.total, quote.currency)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/quotations" extraParams={{ status: activeStatus }} />
    </div>
  );
}
