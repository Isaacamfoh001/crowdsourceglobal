import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { adminDashboardService } from "../../../../modules/admin-dashboard/service";
import type { SearchResultType } from "../../../../modules/admin-dashboard/types";

export const metadata = { title: "Search — Admin" };
export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<SearchResultType, string> = {
  ORDER: "Order",
  QUOTATION: "Quotation",
  SOURCING_REQUEST: "Sourcing request",
  VENDOR: "Vendor",
  CUSTOMER: "Customer",
  LISTING: "Listing",
  SHIPMENT: "Shipment",
  RESOLUTION_CASE: "Case",
  PAYMENT: "Payment",
  SETTLEMENT: "Settlement",
};

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { admin } = await requireAdminSession("/admin/search");
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length >= 2 ? await adminDashboardService.search(query, admin.role) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">Search</h1>
        <p className="mt-1 text-sm text-stone-500">
          {query ? `Results for "${query}"` : "Search by order, quote, sourcing, vendor, customer, listing, or tracking reference."}
        </p>
      </div>

      {query.length > 0 && query.length < 2 ? (
        <p className="text-sm text-stone-500">Enter at least 2 characters.</p>
      ) : results.length === 0 && query ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No matches for &quot;{query}&quot;.</p>
        </div>
      ) : results.length > 0 ? (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {results.map((result, index) => (
            <li key={`${result.type}-${result.targetUrl}-${index}`}>
              <Link href={result.targetUrl} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">{result.label}</p>
                  <p className="mt-0.5 truncate text-sm text-stone-500">{result.sublabel}</p>
                </div>
                <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                  {TYPE_LABELS[result.type]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
