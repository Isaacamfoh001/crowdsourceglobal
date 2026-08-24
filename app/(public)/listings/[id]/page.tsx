import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Package, ShoppingBag, Store } from "lucide-react";
import { Container } from "../../../../components/ui/Container";
import { Button } from "../../../../components/ui/Button";
import { Breadcrumbs } from "../../../../components/catalogue/Breadcrumbs";
import { ListingImageGallery } from "../../../../components/catalogue/ListingImageGallery";
import { AvailabilityBadge } from "../../../../components/catalogue/AvailabilityBadge";
import { BulkPricingTable } from "../../../../components/catalogue/BulkPricingTable";
import { AddToCartForm } from "../../../../components/catalogue/AddToCartForm";
import { GetInstantQuoteForm } from "../../../../components/catalogue/GetInstantQuoteForm";
import { AskAboutButton } from "../../../../components/messaging/AskAboutButton";
import { formatPrice } from "../../../../lib/format";
import { catalogueService } from "../../../../modules/catalogue/service";
import { getCurrentSession } from "../../../../modules/identity/policy";
import { getPendingMessageIntent } from "../../../../lib/actions/messaging";
import { getPendingQuoteIntent } from "../../../../lib/actions/quotation";

type Params = { id: string };

export const dynamic = "force-dynamic";

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

  const session = await getCurrentSession();
  const isSignedIn = Boolean(session);
  const resumedMessage = await getPendingMessageIntent("LISTING", listing.id);
  const resumedQuoteQuantity = isSignedIn ? await getPendingQuoteIntent(listing.id) : null;

  return (
    <div className="bg-ivory-50 py-8 sm:py-12">
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

        {/* Editorial split: a plain gallery column against ivory, and a
            purchase column that carries its own quieter ivory-100 tint —
            two contrasting surfaces instead of one canvas with cards
            floated on top of it. */}
        <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-[1.1fr_1fr]">
          <ListingImageGallery images={listing.images} categorySlug={listing.category.slug} title={listing.title} />

          <div>
            <Link
              href={`/vendors/${listing.vendor.storefrontSlug}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.1em] text-espresso-900/50 uppercase hover:text-champagne-700"
            >
              <Store className="size-3.5" strokeWidth={1.75} />
              {listing.vendor.companyName}
            </Link>

            <h1 className="mt-2 font-display text-3xl font-medium text-espresso-950 sm:text-4xl">
              {listing.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="font-display text-3xl font-semibold text-espresso-950 sm:text-4xl">
                {formatPrice(listing.basePrice, listing.currency)}
              </p>
              <AvailabilityBadge status={listing.availabilityStatus} />
            </div>

            {/* Quick commerce facts as an inline row, not another card —
                scannable in one glance before the purchase action. */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-espresso-900/55">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="size-3.5" strokeWidth={1.75} />
                MOQ {listing.moq} {listing.moq === 1 ? "unit" : "units"}
              </span>
              {listing.leadTimeDays ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" strokeWidth={1.75} />
                  {listing.leadTimeDays}-day lead time
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Package className="size-3.5" strokeWidth={1.75} />
                {listing.availableQuantity} available
              </span>
            </div>

            {/* Purchase controls come right after price, ahead of secondary
                commerce details, so mobile shoppers reach "add to cart"
                without scrolling past MOQ/lead-time metadata first. */}
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

            {listing.bulkPriceTiers.length > 0 ? (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold tracking-[0.1em] text-champagne-700 uppercase">
                  Bulk pricing
                </p>
                <BulkPricingTable tiers={listing.bulkPriceTiers} currency={listing.currency} />
              </div>
            ) : null}

            {listing.bulkPriceTiers.length > 0 ? (
              <GetInstantQuoteForm
                listingId={listing.id}
                currentPath={`/listings/${listing.id}`}
                basePrice={listing.basePrice}
                currency={listing.currency}
                moq={listing.moq}
                maxOq={listing.maxOq}
                availableQuantity={listing.availableQuantity}
                bulkPriceTiers={listing.bulkPriceTiers}
                resumedQuantity={resumedQuoteQuantity}
              />
            ) : null}

            {listing.maxOq ? (
              <p className="mt-4 text-sm text-espresso-900/50">Maximum order quantity: {listing.maxOq} units</p>
            ) : null}
          </div>
        </div>

        <div className="mt-16 grid gap-10 border-t border-ivory-300 pt-12 lg:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="font-display text-xl font-medium text-espresso-950">Description</h2>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-espresso-900/70">
              {listing.description}
            </p>

            {listing.specs && Object.keys(listing.specs).length > 0 ? (
              <div className="mt-8">
                <h2 className="font-display text-xl font-medium text-espresso-950">Specifications</h2>
                <dl className="mt-3 divide-y divide-ivory-300 border-t border-ivory-300">
                  {Object.entries(listing.specs).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4 py-3 text-sm">
                      <dt className="shrink-0 text-espresso-900/50">{key}</dt>
                      <dd className="text-right font-medium text-espresso-950">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </div>

          <div className="h-fit">
            <p className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Sold by</p>
            <Link
              href={`/vendors/${listing.vendor.storefrontSlug}`}
              className="mt-1.5 flex items-center gap-1.5 font-display text-lg font-medium text-espresso-950 hover:text-forest-800"
            >
              <Store className="size-4 shrink-0 text-espresso-900/40" strokeWidth={1.75} />
              {listing.vendor.companyName}
            </Link>
            {listing.vendor.description ? (
              <p className="mt-3 text-sm leading-relaxed text-espresso-900/70">
                {listing.vendor.description}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2.5 border-t border-ivory-300 pt-5">
              <Link href={`/vendors/${listing.vendor.storefrontSlug}`}>
                <Button variant="outline" size="sm" fullWidth>
                  Visit storefront
                </Button>
              </Link>
              <AskAboutButton
                contextType="LISTING"
                contextRefId={listing.id}
                currentPath={`/listings/${listing.id}`}
                isSignedIn={isSignedIn}
                resumedBody={resumedMessage}
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
