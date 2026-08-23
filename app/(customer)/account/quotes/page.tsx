import Link from "next/link";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { QuoteStatusBadge } from "../../../../components/quotation/QuoteStatusBadge";
import { Pagination } from "../../../../components/shared/Pagination";
import { formatPrice } from "../../../../lib/format";
import { requireSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { quotationService } from "../../../../modules/quotation/service";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Your quotes" };
export const dynamic = "force-dynamic";

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireSession("/account/quotes");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: quotes, total, pageSize } = customerProfile
    ? await quotationService.listForCustomer(customerProfile.id, currentPage)
    : { rows: [], total: 0, pageSize: 20 };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-espresso-950">Your quotes</h1>
        <p className="mt-1 text-sm text-espresso-900/50">
          Instant quotations you&apos;ve generated — pricing is locked until each quote expires.
        </p>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          description="You haven't generated a quote yet."
          actionHref="/shop"
          actionLabel="Browse bulk pricing"
        />
      ) : (
        <div className="divide-y divide-ivory-100 rounded-2xl border border-ivory-300 bg-white">
          {quotes.map((quote) => (
            <Link
              key={quote.id}
              href={`/account/quotes/${quote.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">{quote.reference}</p>
                <p className="text-xs text-espresso-900/50">
                  Issued{" "}
                  {quote.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                  · {quote.itemCount} item{quote.itemCount === 1 ? "" : "s"} · valid until{" "}
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
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/account/quotes" />
    </div>
  );
}
