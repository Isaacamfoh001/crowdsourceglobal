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
  const [categories, featuredListings] = await Promise.all([
    catalogueService.listCategories(),
    catalogueService.listFeaturedListings(6),
  ]);

  return (
    <>
      <Hero />
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
