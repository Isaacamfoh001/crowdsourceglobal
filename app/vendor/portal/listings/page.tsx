import Link from "next/link";
import { Package } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { ListingStatusBadge } from "../../../../components/vendor-portal/ListingStatusBadge";
import { Pagination } from "../../../../components/shared/Pagination";
import { formatPrice } from "../../../../lib/format";
import { listingImageUrl } from "../../../../lib/listing-images";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { vendorListingsService } from "../../../../modules/vendor-listings/service";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Listings — Vendor Portal" };
export const dynamic = "force-dynamic";

const AVAILABILITY_LABEL: Record<string, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  MADE_TO_ORDER: "Made to order",
};

const AVAILABILITY_CLASSES: Record<string, string> = {
  IN_STOCK: "text-espresso-900/50",
  LOW_STOCK: "text-champagne-700",
  OUT_OF_STOCK: "text-danger-700",
  MADE_TO_ORDER: "text-espresso-900/50",
};

export default async function VendorListingsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/listings");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: listings, total, pageSize } = await vendorListingsService.listForVendorPaginated(vendorId, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Listings"
        description="What customers can find and buy from your store."
        actions={
          <Link href="/vendor/portal/listings/new">
            <Button>+ New listing</Button>
          </Link>
        }
      />

      {listings.length === 0 ? (
        <EmptyState
          icon={Package}
          title="You haven't created any listings yet"
          description="Add your first product so customers can start discovering your store."
          actionHref="/vendor/portal/listings/new"
          actionLabel="Create your first listing"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Link
                href={`/vendor/portal/listings/${listing.id}`}
                className="flex items-center gap-4 rounded-2xl border border-ivory-300 bg-white p-3 transition-shadow hover:shadow-lifted sm:p-4"
              >
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ivory-100 sm:size-20">
                  {listing.primaryImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- storage-backed product photo, not Next's image optimizer (see M13.1)
                    <img src={listingImageUrl(listing.primaryImage)} alt="" className="size-full object-cover" />
                  ) : (
                    <Package className="size-6 text-ivory-400" strokeWidth={1.5} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-espresso-950">{listing.title || "Untitled listing"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium text-espresso-950">{formatPrice(listing.basePrice, listing.currency)}</span>
                    <span className="text-ivory-400">·</span>
                    <span className={AVAILABILITY_CLASSES[listing.availabilityStatus] ?? "text-espresso-900/50"}>
                      {AVAILABILITY_LABEL[listing.availabilityStatus] ?? listing.availabilityStatus}
                      {listing.availabilityStatus !== "MADE_TO_ORDER" ? ` · Qty ${listing.availableQuantity}` : ""}
                    </span>
                  </div>
                  <div className="mt-2 sm:hidden">
                    <ListingStatusBadge listing={listing} />
                  </div>
                </div>

                <div className="hidden shrink-0 sm:block">
                  <ListingStatusBadge listing={listing} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/vendor/portal/listings" />
    </div>
  );
}
