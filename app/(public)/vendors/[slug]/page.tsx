import { notFound } from "next/navigation";
import { ShieldCheck, Store } from "lucide-react";
import { Container } from "../../../../components/ui/Container";
import { Badge } from "../../../../components/ui/Badge";
import { ListingCard } from "../../../../components/catalogue/ListingCard";
import { EmptyState } from "../../../../components/catalogue/EmptyState";
import { Breadcrumbs } from "../../../../components/catalogue/Breadcrumbs";
import { AskAboutButton } from "../../../../components/messaging/AskAboutButton";
import { vendorsService } from "../../../../modules/vendors/service";
import { getCurrentSession } from "../../../../modules/identity/policy";
import { getPendingMessageIntent } from "../../../../lib/actions/messaging";

type Params = { slug: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const storefront = await vendorsService.getStorefront(slug);
  return { title: storefront ? storefront.vendor.companyName : "Vendor" };
}

export default async function VendorStorefrontPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const storefront = await vendorsService.getStorefront(slug);

  if (!storefront) {
    notFound();
  }

  const { vendor, listings } = storefront;
  const session = await getCurrentSession();
  const isSignedIn = Boolean(session);
  const resumedMessage = await getPendingMessageIntent("VENDOR", vendor.id);

  return (
    <div className="bg-stone-50 py-10 sm:py-14">
      <Container>
        <Breadcrumbs items={[{ label: "Shop", href: "/shop" }, { label: vendor.companyName }]} />

        <div className="mt-6 flex flex-col gap-6 rounded-2xl border border-stone-200 bg-white p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-800">
            <Store className="size-8" strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-medium text-stone-900">
                {vendor.companyName}
              </h1>
              <Badge tone="brand" className="normal-case">
                <ShieldCheck className="size-3.5" strokeWidth={2} />
                Approved vendor
              </Badge>
            </div>
            {vendor.description ? (
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-stone-600">
                {vendor.description}
              </p>
            ) : null}
            <div className="mt-3">
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
          </div>
        </div>

        <div className="mt-10">
          <h2 className="font-display text-xl font-medium text-stone-900">
            Listings from {vendor.companyName}
          </h2>

          {listings.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No active listings"
                description="This vendor doesn't have any listings live right now."
              />
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
