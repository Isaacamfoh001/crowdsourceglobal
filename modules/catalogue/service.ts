import { catalogueRepository } from "./repository";
import { pricingService } from "../pricing/service";
import type { ListingFilter } from "./types";

/**
 * (M11.1) Shared page size for the public listing grid — /shop,
 * /shop/[category], and vendor storefronts all use this so paging feels
 * consistent across the three surfaces. 24 matches a clean multiple of the
 * grid's column counts (2 / 3 / 4 columns, see the Tailwind classes in the
 * three page components) rather than the generic lib/pagination.ts default.
 */
export const CATALOGUE_PAGE_SIZE = 24;

export const catalogueService = {
  listCategories() {
    return catalogueRepository.listTopLevelCategoriesWithChildren();
  },

  async getCategoryBySlug(slug: string) {
    return catalogueRepository.findCategoryBySlug(slug);
  },

  /** A category's listings include its direct children's listings. */
  async listListingsForCategorySlug(
    slug: string,
    options: { search?: string; page: number; pageSize: number },
  ) {
    const category = await catalogueRepository.findCategoryBySlug(slug);
    if (!category) {
      return { category: null, rows: [], total: 0, pageSize: options.pageSize };
    }

    const categoryIds = [category.id, ...category.children.map((child) => child.id)];
    const { rows, total } = await catalogueRepository.listListings(
      { categoryIds, search: options.search },
      { page: options.page, pageSize: options.pageSize },
    );

    return { category, rows, total, pageSize: options.pageSize };
  },

  listListings(filter: ListingFilter, page: number, pageSize: number) {
    return catalogueRepository.listListings(filter, { page, pageSize });
  },

  /** Bounded, unpaginated slice — see catalogueRepository.listListingsCapped. */
  listListingsCapped(filter: ListingFilter, take: number) {
    return catalogueRepository.listListingsCapped(filter, take);
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
    return catalogueRepository.listListingsCapped({}, take);
  },
};
