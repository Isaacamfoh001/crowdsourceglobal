import Link from "next/link";
import { Layers } from "lucide-react";
import { ListingImagePlaceholder } from "./ListingImagePlaceholder";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { formatPrice } from "../../lib/format";
import { listingImageUrl } from "../../lib/listing-images";
import type { PublicListingSummary } from "../../modules/catalogue/types";

/**
 * The core commerce card (M14.3) — a tall editorial 4:5 image with almost
 * no outer chrome (no border, no card shadow at rest — only a quiet lift on
 * hover) so the grid reads as photography, not stacked boxes. Price gets
 * the strongest typographic weight; vendor is a quiet uppercase label.
 */
export function ListingCard({ listing }: { listing: PublicListingSummary }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex min-w-0 flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-champagne-600"
    >
      <div className="relative overflow-hidden bg-ivory-200 transition-opacity duration-200 group-hover:opacity-90">
        {listing.primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- served through our own storage-backed route, not Next's image optimizer (no sharp installed — see M13.1 report)
          <img
            src={listingImageUrl(listing.primaryImage)}
            alt={listing.title}
            loading="lazy"
            className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <ListingImagePlaceholder categorySlug={listing.category.slug} className="aspect-[4/5]" />
        )}
        {listing.availabilityStatus !== "IN_STOCK" ? (
          <div className="absolute right-2.5 top-2.5">
            <AvailabilityBadge status={listing.availabilityStatus} />
          </div>
        ) : null}
        {listing.hasBulkPricing ? (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-espresso-950/85 px-2.5 py-1 text-[11px] font-semibold text-champagne-300 backdrop-blur-sm">
            <Layers className="size-3 shrink-0" strokeWidth={2.25} />
            Bulk pricing
          </div>
        ) : null}
      </div>

      <div className="mt-3.5 flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[11px] font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">
          {listing.vendor.companyName}
        </p>
        <h3 className="line-clamp-2 text-[15px] leading-snug font-medium text-espresso-950">
          {listing.title}
        </h3>
        <div className="mt-1 flex items-baseline gap-1.5">
          <p className="font-display text-lg font-semibold text-espresso-950">
            {formatPrice(listing.basePrice, listing.currency)}
          </p>
          {listing.moq > 1 ? <p className="text-xs text-espresso-900/40">MOQ {listing.moq}</p> : null}
        </div>
      </div>
    </Link>
  );
}
