import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Package, ShoppingBag, Store } from "lucide-react";
import { Container } from "../../../../components/ui/Container";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { Breadcrumbs } from "../../../../components/catalogue/Breadcrumbs";
import { ListingImagePlaceholder } from "../../../../components/catalogue/ListingImagePlaceholder";
import { AvailabilityBadge } from "../../../../components/catalogue/AvailabilityBadge";
import { BulkPricingTable } from "../../../../components/catalogue/BulkPricingTable";
import { AddToCartForm } from "../../../../components/catalogue/AddToCartForm";
import { AskAboutButton } from "../../../../components/messaging/AskAboutButton";
import { formatPrice } from "../../../../lib/format";
import { catalogueService } from "../../../../modules/catalogue/service";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const listing = await catalogueService.getListingDetail(id);
  return { title: listing ? listing.title : "Listing" };
}

export default async function ListingDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const listing = await catalogueService.getListingDetail(id);

  if (!listing) {
    notFound();
  }

  return (
    <div className="bg-stone-50 py-10 sm:py-14">
      <Container>
        <Breadcrumbs
          items={[
            { label: "Shop", href: "/shop" },
            ...(listing.category.parent
              ? [{ label: listing.category.parent.name, href: `/shop/${listing.category.parent.slug}` }]
              : []),
            { label: listing.category.name, href: `/shop/${listing.category.slug}` },
            { label: listing.title },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-2">
          <ListingImagePlaceholder
            categorySlug={listing.category.slug}
            className="aspect-square rounded-2xl border border-stone-200"
          />

          <div>
            <Link
              href={`/vendors/${listing.vendor.storefrontSlug}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-brand-700"
            >
              <Store className="size-4" strokeWidth={1.75} />
              {listing.vendor.companyName}
            </Link>

            <h1 className="mt-2 font-display text-2xl font-medium text-stone-900 sm:text-3xl">
              {listing.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-2xl font-semibold text-stone-900 sm:text-3xl">
                {formatPrice(listing.basePrice, listing.currency)}
              </p>
              <AvailabilityBadge status={listing.availabilityStatus} />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-stone-200 bg-white p-5 text-sm sm:grid-cols-3">
              <div>
                <p className="flex items-center gap-1.5 text-stone-500">
                  <ShoppingBag className="size-4" strokeWidth={1.75} />
                  MOQ
                </p>
                <p className="mt-1 font-medium text-stone-900">
                  {listing.moq} {listing.moq === 1 ? "unit" : "units"}
                </p>
              </div>
              {listing.maxOq ? (
                <div>
                  <p className="text-stone-500">Max order</p>
                  <p className="mt-1 font-medium text-stone-900">{listing.maxOq} units</p>
                </div>
              ) : null}
              {listing.leadTimeDays ? (
                <div>
                  <p className="flex items-center gap-1.5 text-stone-500">
                    <Clock className="size-4" strokeWidth={1.75} />
                    Lead time
                  </p>
                  <p className="mt-1 font-medium text-stone-900">{listing.leadTimeDays} days</p>
                </div>
              ) : null}
              <div>
                <p className="flex items-center gap-1.5 text-stone-500">
                  <Package className="size-4" strokeWidth={1.75} />
                  Available
                </p>
                <p className="mt-1 font-medium text-stone-900">{listing.availableQuantity} units</p>
              </div>
            </div>

            {listing.bulkPriceTiers.length > 0 ? (
              <div className="mt-6">
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone="gold">Bulk pricing</Badge>
                </div>
                <BulkPricingTable tiers={listing.bulkPriceTiers} currency={listing.currency} />
              </div>
            ) : null}

            <AddToCartForm
              listingId={listing.id}
              currentPath={`/listings/${listing.id}`}
              basePrice={listing.basePrice}
              currency={listing.currency}
              moq={listing.moq}
              maxOq={listing.maxOq}
              availableQuantity={listing.availableQuantity}
              availabilityStatus={listing.availabilityStatus}
              bulkPriceTiers={listing.bulkPriceTiers}
            />
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="font-display text-xl font-medium text-stone-900">Description</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-stone-600">
              {listing.description}
            </p>

            {listing.specs && Object.keys(listing.specs).length > 0 ? (
              <div className="mt-8">
                <h2 className="font-display text-xl font-medium text-stone-900">Specifications</h2>
                <dl className="mt-3 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
                  {Object.entries(listing.specs).map(([key, value]) => (
                    <div key={key} className="flex justify-between px-5 py-3 text-sm">
                      <dt className="text-stone-500">{key}</dt>
                      <dd className="font-medium text-stone-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="font-display text-lg font-medium text-stone-900">Sold by</h2>
            <p className="mt-2 text-[15px] font-medium text-stone-900">
              {listing.vendor.companyName}
            </p>
            {listing.vendor.description ? (
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                {listing.vendor.description}
              </p>
            ) : null}
            <Link href={`/vendors/${listing.vendor.storefrontSlug}`}>
              <Button variant="outline" size="sm" fullWidth className="mt-4">
                Visit storefront
              </Button>
            </Link>
            <div className="mt-4">
              <AskAboutButton
                contextType="LISTING"
                contextRefId={listing.id}
                label="Ask about this item"
                placeholder={`Ask CrownSourceGlobal about "${listing.title}"…`}
              />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
