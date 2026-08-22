import Link from "next/link";
import { Layers } from "lucide-react";
import { ListingImagePlaceholder } from "./ListingImagePlaceholder";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { formatPrice } from "../../lib/format";
import { listingImageUrl } from "../../lib/listing-images";
import type { PublicListingSummary } from "../../modules/catalogue/types";

export function ListingCard({ listing }: { listing: PublicListingSummary }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition-shadow hover:shadow-lifted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
    >
      {listing.primaryImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- served through our own storage-backed route, not Next's image optimizer (no sharp installed — see M13.1 report)
        <img
          src={listingImageUrl(listing.primaryImage)}
          alt={listing.title}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <ListingImagePlaceholder categorySlug={listing.category.slug} className="aspect-[4/3]" />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <p className="truncate text-xs font-medium text-stone-500">{listing.vendor.companyName}</p>
        <h3 className="line-clamp-2 font-display text-sm font-medium leading-snug text-stone-900 group-hover:text-brand-800 sm:text-[15px]">
          {listing.title}
        </h3>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-2">
          <div className="min-w-0">
            <p className="text-base font-semibold text-stone-900 sm:text-lg">
              {formatPrice(listing.basePrice, listing.currency)}
            </p>
            {listing.moq > 1 ? (
              <p className="text-xs text-stone-500">MOQ {listing.moq}</p>
            ) : null}
          </div>
          <AvailabilityBadge status={listing.availabilityStatus} />
        </div>

        {listing.hasBulkPricing ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-gold-700">
            <Layers className="size-3.5 shrink-0" strokeWidth={2} />
            <span className="truncate">Bulk pricing available</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
