import type { PublicBulkPriceTier } from "../pricing/types";

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  parentCategoryId: string | null;
};

export type PublicCategoryWithChildren = PublicCategory & {
  children: PublicCategory[];
};

export type PublicListingVendor = {
  id: string;
  companyName: string;
  storefrontSlug: string;
};

export type PublicListingCategory = {
  id: string;
  name: string;
  slug: string;
};

/**
 * Grid/card view of a listing. Deliberately excludes description/specs
 * (detail-page only) and — like every public catalogue type — vendor
 * cost/margin, which has no representation here at all.
 */
export type PublicListingSummary = {
  id: string;
  title: string;
  basePrice: number;
  currency: string;
  moq: number;
  availabilityStatus: string;
  hasBulkPricing: boolean;
  /** First entry of the listing's images[] (M13.1), or null for a listing with no images — see lib/listing-images.ts to render it. */
  primaryImage: string | null;
  category: PublicListingCategory;
  vendor: PublicListingVendor;
};

export type PublicListingDetail = {
  id: string;
  title: string;
  description: string;
  images: string[];
  specs: Record<string, string> | null;
  basePrice: number;
  currency: string;
  moq: number;
  maxOq: number | null;
  leadTimeDays: number | null;
  availableQuantity: number;
  availabilityStatus: string;
  category: PublicListingCategory & { parent: PublicListingCategory | null };
  vendor: PublicListingVendor & { description: string | null };
  bulkPriceTiers: PublicBulkPriceTier[];
};

export type ListingFilter = {
  /** A category and its descendants — browsing a parent category includes children's listings. */
  categoryIds?: string[];
  vendorId?: string;
  search?: string;
};
