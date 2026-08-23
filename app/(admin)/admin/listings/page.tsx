import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { vendorListingsService } from "../../../../modules/vendor-listings/service";
import { formatPrice } from "../../../../lib/format";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Card } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";

export const metadata = { title: "Listing moderation — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminSession("/admin/listings");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: listings, total, pageSize } = await vendorListingsService.listPendingForAdminPaginated(currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Listings awaiting review" description={`${total} listing${total === 1 ? "" : "s"} pending moderation.`} />

      {listings.length === 0 ? (
        <EmptyState title="Nothing to review" description="No listings awaiting review." />
      ) : (
        <Card as="ul" padded={false} className="divide-y divide-ivory-100">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Link
                href={`/admin/listings/${listing.id}`}
                className="flex flex-col gap-1 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-espresso-950">{listing.title}</p>
                  <p className="text-xs text-espresso-900/50">
                    {listing.vendorName} · {formatPrice(listing.basePrice, listing.currency)}
                  </p>
                </div>
                <Badge tone={listing.isEdit ? "gold" : "brand"} className="w-fit shrink-0">
                  {listing.isEdit ? "Edit to live listing" : "New listing"}
                </Badge>
              </Link>
            </li>
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/listings" />
    </div>
  );
}
