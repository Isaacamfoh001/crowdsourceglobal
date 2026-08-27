import { serializeMoney } from "../response";
import { absoluteImageUrl } from "../images";
import type {
  PublicCategory,
  PublicCategoryWithChildren,
  PublicListingDetail,
  PublicListingSummary,
} from "../../../modules/catalogue/types";
import type { PublicVendorProfile } from "../../../modules/vendors/types";

/**
 * M18.2 — shared DTO mappers for the public commerce discovery API.
 * `modules/catalogue`/`modules/vendors` already return deliberate,
 * public-safe view types (never a raw Prisma row, never vendor cost/
 * margin/moderation-internal fields) — these functions only add the
 * HTTP-response concerns those service/repository types don't carry
 * themselves: the M18.1 money/image-URL conventions. No new field is
 * read here that the underlying `Public*` type didn't already expose.
 */

export function toCategoryDTO(category: PublicCategory) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentCategoryId: category.parentCategoryId,
  };
}

export function toCategoryWithChildrenDTO(category: PublicCategoryWithChildren) {
  return { ...toCategoryDTO(category), children: category.children.map(toCategoryDTO) };
}

/** The lightweight "listing card" shape — reused by /listings, /home, /explore, and vendor storefronts. Never the full detail payload (Phase 12). */
export function toListingSummaryDTO(listing: PublicListingSummary) {
  return {
    id: listing.id,
    title: listing.title,
    price: serializeMoney(listing.basePrice, listing.currency),
    moq: listing.moq,
    availabilityStatus: listing.availabilityStatus,
    hasBulkPricing: listing.hasBulkPricing,
    primaryImage: listing.primaryImage ? absoluteImageUrl(listing.primaryImage) : null,
    category: { id: listing.category.id, name: listing.category.name, slug: listing.category.slug },
    vendor: { id: listing.vendor.id, companyName: listing.vendor.companyName, storefrontSlug: listing.vendor.storefrontSlug },
  };
}

export function toListingDetailDTO(listing: PublicListingDetail) {
  return {
    id: listing.id,
    title: listing.title,
    description: listing.description,
    images: listing.images.map(absoluteImageUrl),
    specs: listing.specs,
    price: serializeMoney(listing.basePrice, listing.currency),
    moq: listing.moq,
    maxOq: listing.maxOq,
    leadTimeDays: listing.leadTimeDays,
    availableQuantity: listing.availableQuantity,
    availabilityStatus: listing.availabilityStatus,
    category: {
      id: listing.category.id,
      name: listing.category.name,
      slug: listing.category.slug,
      parent: listing.category.parent
        ? { id: listing.category.parent.id, name: listing.category.parent.name, slug: listing.category.parent.slug }
        : null,
    },
    vendor: {
      id: listing.vendor.id,
      companyName: listing.vendor.companyName,
      storefrontSlug: listing.vendor.storefrontSlug,
      description: listing.vendor.description,
    },
    bulkPriceTiers: listing.bulkPriceTiers.map((tier) => ({
      id: tier.id,
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      unitPrice: serializeMoney(tier.unitPrice, listing.currency),
    })),
  };
}

/**
 * `verificationStatus` is not part of `PublicVendorProfile` (the
 * repository never selects it) — it is hardcoded to `"APPROVED"` here
 * rather than added to that type/query, because `vendorsRepository.
 * findPublicVendorBySlug`'s own WHERE clause already guarantees no other
 * value can ever reach this function; the web storefront page shows the
 * same fixed "Approved vendor" badge unconditionally for the same reason.
 */
export function toVendorStorefrontDTO(vendor: PublicVendorProfile) {
  return {
    id: vendor.id,
    companyName: vendor.companyName,
    description: vendor.description,
    storefrontSlug: vendor.storefrontSlug,
    sellerType: vendor.sellerType,
    logoUrl: vendor.logoUrl,
    country: vendor.country,
    region: vendor.region,
    city: vendor.city,
    categorySlugs: vendor.categorySlugs,
    verificationStatus: "APPROVED" as const,
  };
}
