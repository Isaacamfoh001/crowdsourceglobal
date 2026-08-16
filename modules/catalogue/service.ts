import { catalogueRepository } from "./repository";
import { pricingService } from "../pricing/service";
import type { ListingFilter } from "./types";

export const catalogueService = {
  listCategories() {
    return catalogueRepository.listTopLevelCategoriesWithChildren();
  },

  async getCategoryBySlug(slug: string) {
    return catalogueRepository.findCategoryBySlug(slug);
  },

  /** A category's listings include its direct children's listings. */
  async listListingsForCategorySlug(slug: string, options: { search?: string } = {}) {
    const category = await catalogueRepository.findCategoryBySlug(slug);
    if (!category) {
      return { category: null, listings: [] };
    }

    const categoryIds = [category.id, ...category.children.map((child) => child.id)];
    const listings = await catalogueRepository.listListings({
      categoryIds,
      search: options.search,
    });

    return { category, listings };
  },

  listListings(filter: ListingFilter, pagination?: { take?: number }) {
    return catalogueRepository.listListings(filter, pagination);
  },

  async getListingDetail(id: string) {
    const listing = await catalogueRepository.getListingById(id);
    if (!listing) {
      return null;
    }

    const bulkPriceTiers = await pricingService.getBulkTiersForListing(id);
    return { ...listing, bulkPriceTiers };
  },

  async listFeaturedListings(take = 6) {
    return catalogueRepository.listListings({}, { take });
  },
};
