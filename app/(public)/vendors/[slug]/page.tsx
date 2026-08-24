import { notFound } from "next/navigation";
import { Layers, MapPin, ShieldCheck, Store } from "lucide-react";
import { Container } from "../../../../components/ui/Container";
import { Badge } from "../../../../components/ui/Badge";
import { ListingCard } from "../../../../components/catalogue/ListingCard";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Breadcrumbs } from "../../../../components/catalogue/Breadcrumbs";
import { AskAboutButton } from "../../../../components/messaging/AskAboutButton";
import { Pagination } from "../../../../components/shared/Pagination";
import { parsePage } from "../../../../lib/pagination";
import { vendorsService } from "../../../../modules/vendors/service";
import { CATALOGUE_PAGE_SIZE } from "../../../../modules/catalogue/service";
import { getCurrentSession } from "../../../../modules/identity/policy";
import { getPendingMessageIntent } from "../../../../lib/actions/messaging";

type Params = { slug: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const storefront = await vendorsService.getStorefront(slug);
  return { title: storefront ? storefront.vendor.companyName : "Vendor" };
}

export default async function VendorStorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageRaw } = await searchParams;
  const page = parsePage(pageRaw);
  const storefront = await vendorsService.getStorefront(slug, page, CATALOGUE_PAGE_SIZE);

  if (!storefront) {
    notFound();
  }

  const { vendor, listings, total } = storefront;
  const session = await getCurrentSession();
  const isSignedIn = Boolean(session);
  const resumedMessage = await getPendingMessageIntent("VENDOR", vendor.id);

  return (
    <div className="bg-ivory-50 pb-14">
      {/* Light editorial identity block (M14.4) — replaces the dark
          gradient cover band and giant watermark initial, which read as
          decoration rather than brand identity once a store has no real
          cover photo. A vendor's own product photography (via their
          listings below) now does the work of "branding" the page. */}
      <div className="border-b border-ivory-300 pt-8 pb-10 sm:pt-10 sm:pb-12">
        <Container>
          <Breadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: vendor.companyName }]} />

          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            {vendor.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- vendor-supplied external logo URL, not our optimized image pipeline
              <img
                src={vendor.logoUrl}
                alt=""
                className="size-16 shrink-0 rounded-full border border-ivory-300 object-cover sm:size-20"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-ivory-300 bg-ivory-100 text-espresso-900/50 sm:size-20">
                <Store className="size-7" strokeWidth={1.5} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-medium text-espresso-950 sm:text-[28px]">
                  {vendor.companyName}
                </h1>
                <Badge tone="neutral" className="normal-case">
                  <ShieldCheck className="size-3.5" strokeWidth={2} />
                  Approved vendor
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-espresso-900/55">
                {vendor.city || vendor.region || vendor.country ? (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
                    {[vendor.city, vendor.region, vendor.country].filter(Boolean).join(", ")}
                  </p>
                ) : null}
                <p className="flex items-center gap-1.5">
                  <Layers className="size-3.5 shrink-0" strokeWidth={1.75} />
                  {total} listing{total === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>

          {vendor.description ? (
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-espresso-900/70">
              {vendor.description}
            </p>
          ) : null}
          <div className="mt-4">
            <AskAboutButton
              contextType="VENDOR"
              contextRefId={vendor.id}
              currentPath={`/vendors/${vendor.storefrontSlug}`}
              isSignedIn={isSignedIn}
              resumedBody={resumedMessage}
              label="Ask about this vendor"
              placeholder={`Ask CrownSourceGlobal about ${vendor.companyName}…`}
            />
          </div>
        </Container>
      </div>

      <Container>
        <div className="mt-10">
          <div className="flex items-baseline justify-between gap-4 border-b border-ivory-300 pb-3">
            <h2 className="font-display text-xl font-medium text-espresso-950">
              Listings from {vendor.companyName}
            </h2>
            {listings.length > 0 ? (
              <p className="shrink-0 text-sm text-espresso-900/50 tabular-nums">{total} total</p>
            ) : null}
          </div>

          {listings.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No active listings"
                description="This vendor doesn't have any listings live right now."
              />
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 xl:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}

          <div className="mt-6">
            <Pagination
              currentPage={page}
              pageSize={CATALOGUE_PAGE_SIZE}
              total={total}
              basePath={`/vendors/${vendor.storefrontSlug}`}
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
