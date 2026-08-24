import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { quotationService } from "../../../../modules/quotation/service";
import { QuoteStatusBadge } from "../../../../components/quotation/QuoteStatusBadge";
import { formatPrice } from "../../../../lib/format";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Card } from "../../../../components/ui/Card";
import { EmptyState } from "../../../../components/ui/EmptyState";

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
      <PageHeader title="Quotations" description={`${total} quotation${total === 1 ? "" : "s"}.`} />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/quotations?status=${filter.value}` : "/admin/quotations"}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeStatus === filter.value
                ? "bg-forest-800 text-white"
                : "bg-ivory-50 text-espresso-900/65 ring-1 ring-ivory-300 hover:bg-ivory-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {quotes.length === 0 ? (
        <EmptyState title="No quotations found" description="Try a different status filter." />
      ) : (
        <Card as="div" padded={false} className="divide-y divide-ivory-100">
          {quotes.map((quote) => (
            <Link
              key={quote.id}
              href={`/admin/quotations/${quote.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">{quote.reference}</p>
                <p className="text-xs text-espresso-900/50">
                  {quote.customerName} ({quote.customerEmail}) ·{" "}
                  {quote.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·
                  expires{" "}
                  {quote.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <QuoteStatusBadge status={quote.status} />
                <span className="text-sm font-semibold text-espresso-950">
                  {formatPrice(quote.total, quote.currency)}
                </span>
              </div>
            </Link>
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/quotations" extraParams={{ status: activeStatus }} />
    </div>
  );
}
