import { Hero } from "../../components/home/Hero";
import { PurchasingPaths } from "../../components/home/PurchasingPaths";
import { MarketplacePreview } from "../../components/home/MarketplacePreview";
import { FeaturedListings } from "../../components/home/FeaturedListings";
import { BuyerValue } from "../../components/home/BuyerValue";
import { VendorSection } from "../../components/home/VendorSection";
import { HowItWorks } from "../../components/home/HowItWorks";
import { CustomSourcing } from "../../components/home/CustomSourcing";
import { FinalCta } from "../../components/home/FinalCta";
import { catalogueService } from "../../modules/catalogue/service";

// Homepage now depends on live catalogue data (categories, featured
// listings) — render per-request like /shop rather than freezing a
// build-time snapshot.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, featuredListings, { rows: heroImagePool }] = await Promise.all([
    catalogueService.listCategories(),
    catalogueService.listFeaturedListings(6),
    // Same unfiltered listing query /shop uses, at a small page size — not
    // a "featured" set, just a real pool to draw the hero's photography
    // from (the featured set above may legitimately contain items without
    // photos yet; this doesn't change what counts as "featured").
    catalogueService.listListings({}, 1, 12),
  ]);

  return (
    <>
      <Hero featuredListings={heroImagePool} />
      <PurchasingPaths />
      <MarketplacePreview categories={categories} />
      <FeaturedListings listings={featuredListings} />
      <BuyerValue />
      <VendorSection />
      <HowItWorks />
      <CustomSourcing />
      <FinalCta />
    </>
  );
}
