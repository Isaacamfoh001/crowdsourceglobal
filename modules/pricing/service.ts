import { pricingRepository } from "./repository";

export const pricingService = {
  getBulkTiersForListing(listingId: string) {
    return pricingRepository.findBulkTiersByListingId(listingId);
  },

  getBulkTiersForListings(listingIds: string[]) {
    return pricingRepository.findBulkTiersByListingIds(listingIds);
  },
};
