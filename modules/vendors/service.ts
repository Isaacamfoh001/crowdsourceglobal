import { vendorsRepository } from "./repository";
import { catalogueService } from "../catalogue/service";

export const vendorsService = {
  async getStorefront(slug: string) {
    const vendor = await vendorsRepository.findPublicVendorBySlug(slug);
    if (!vendor) {
      return null;
    }

    const listings = await catalogueService.listListings({ vendorId: vendor.id });
    return { vendor, listings };
  },
};
