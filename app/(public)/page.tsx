import { Hero } from "../../components/home/Hero";
import { PurchasingPaths } from "../../components/home/PurchasingPaths";
import { MarketplacePreview } from "../../components/home/MarketplacePreview";
import { BuyerValue } from "../../components/home/BuyerValue";
import { VendorSection } from "../../components/home/VendorSection";
import { HowItWorks } from "../../components/home/HowItWorks";
import { CustomSourcing } from "../../components/home/CustomSourcing";
import { FinalCta } from "../../components/home/FinalCta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <PurchasingPaths />
      <MarketplacePreview />
      <BuyerValue />
      <VendorSection />
      <HowItWorks />
      <CustomSourcing />
      <FinalCta />
    </>
  );
}
