import Link from "next/link";
import { Button } from "../../../../components/ui/Button";
import { ListingStatusBadge } from "../../../../components/vendor-portal/ListingStatusBadge";
import { Pagination } from "../../../../components/shared/Pagination";
import { formatPrice } from "../../../../lib/format";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { vendorListingsService } from "../../../../modules/vendor-listings/service";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Listings — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorListingsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/listings");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: listings, total, pageSize } = await vendorListingsService.listForVendorPaginated(vendorId, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium text-stone-900">Listings</h1>
        <Link href="/vendor/portal/listings/new">
          <Button>+ New listing</Button>
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">You haven&apos;t created any listings yet.</p>
          <Link href="/vendor/portal/listings/new">
            <Button variant="outline" className="mt-4">
              Create your first listing
            </Button>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/vendor/portal/listings/${listing.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-900">{listing.title}</p>
                <p className="text-xs text-stone-500">{formatPrice(listing.basePrice, listing.currency)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <ListingStatusBadge listing={listing} />
                <span className="text-xs text-stone-400">Qty {listing.availableQuantity}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/vendor/portal/listings" />
    </div>
  );
}
