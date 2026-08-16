import Link from "next/link";
import { Layers } from "lucide-react";
import { ListingImagePlaceholder } from "./ListingImagePlaceholder";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { formatPrice } from "../../lib/format";
import type { PublicListingSummary } from "../../modules/catalogue/types";

export function ListingCard({ listing }: { listing: PublicListingSummary }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition-shadow hover:shadow-lifted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
    >
      <ListingImagePlaceholder categorySlug={listing.category.slug} className="aspect-[4/3]" />

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium text-stone-500">{listing.vendor.companyName}</p>
        <h3 className="line-clamp-2 font-display text-[15px] font-medium leading-snug text-stone-900 group-hover:text-brand-800">
          {listing.title}
        </h3>

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="text-lg font-semibold text-stone-900">
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
            <Layers className="size-3.5" strokeWidth={2} />
            Bulk pricing available
          </div>
        ) : null}
      </div>
    </Link>
  );
}
