import { prisma } from "../../lib/db";
import { paginationSkip } from "../../lib/pagination";
import { CANONICAL_TOP_LEVEL_SLUGS } from "../../prisma/reference-data";
import type {
  ListingFilter,
  PublicCategory,
  PublicCategoryWithChildren,
  PublicListingDetail,
  PublicListingSummary,
} from "./types";

/**
 * Every public catalogue query is scoped to this — an approved AND active
 * listing. Never loosen this in a public-facing query.
 */
const PUBLIC_LISTING_WHERE = {
  approvalStatus: "APPROVED",
  listingStatus: "ACTIVE",
} as const;

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  parentCategoryId: true,
} as const;

const listingSummarySelect = {
  id: true,
  title: true,
  basePrice: true,
  currency: true,
  moq: true,
  availabilityStatus: true,
  images: true,
  category: { select: { id: true, name: true, slug: true } },
  vendor: { select: { id: true, companyName: true, storefrontSlug: true } },
  _count: { select: { bulkPriceTiers: true } },
} as const;

const listingDetailSelect = {
  id: true,
  title: true,
  description: true,
  images: true,
  specs: true,
  basePrice: true,
  currency: true,
  moq: true,
  maxOq: true,
  leadTimeDays: true,
  availableQuantity: true,
  availabilityStatus: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      parent: { select: { id: true, name: true, slug: true } },
    },
  },
  vendor: {
    select: { id: true, companyName: true, storefrontSlug: true, description: true },
  },
} as const;

/**
 * The general, unscoped marketplace feed — /shop's "All" tab, search, and
 * the homepage — is restricted to the canonical beauty-first taxonomy
 * (M14.3), same allowlist as listTopLevelCategoriesWithChildren. This is
 * what actually keeps pre-existing non-beauty demo/test listings
 * (electronics, textiles, ad hoc test fixtures under dynamically created
 * categories, etc.) out of general discovery without deleting anything.
 *
 * Deliberately NOT applied when the caller already scoped the query:
 * `filter.categoryIds` (a direct link to a legacy category, or a canonical
 * one, from /shop/[category]) and `filter.vendorId` (a vendor's own
 * storefront, which must show that vendor's real active catalogue
 * regardless of category — see modules/catalogue/repository.test.ts) both
 * carry their own, more specific scoping and are exempt.
 */
function canonicalCategoryWhere() {
  return {
    OR: [
      { slug: { in: CANONICAL_TOP_LEVEL_SLUGS } },
      { parent: { slug: { in: CANONICAL_TOP_LEVEL_SLUGS } } },
    ],
  };
}

function listingWhere(filter: ListingFilter) {
  const hasCategoryIds = Boolean(filter.categoryIds && filter.categoryIds.length > 0);
  return {
    ...PUBLIC_LISTING_WHERE,
    ...(hasCategoryIds ? { categoryId: { in: filter.categoryIds } } : {}),
    ...(filter.vendorId ? { vendorId: filter.vendorId } : {}),
    ...(!hasCategoryIds && !filter.vendorId ? { category: canonicalCategoryWhere() } : {}),
    ...(filter.search
      ? {
          OR: [
            { title: { contains: filter.search, mode: "insensitive" as const } },
            { description: { contains: filter.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

function parseImages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function parseSpecs(value: unknown): Record<string, string> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, string>;
  }
  return null;
}

type SummaryRow = {
  id: string;
  title: string;
  basePrice: { toNumber: () => number };
  currency: string;
  moq: number;
  availabilityStatus: string;
  images: unknown;
  category: { id: string; name: string; slug: string };
  vendor: { id: string; companyName: string; storefrontSlug: string };
  _count: { bulkPriceTiers: number };
};

function toSummary(row: SummaryRow): PublicListingSummary {
  const images = parseImages(row.images);
  return {
    id: row.id,
    title: row.title,
    basePrice: row.basePrice.toNumber(),
    currency: row.currency,
    moq: row.moq,
    availabilityStatus: row.availabilityStatus,
    hasBulkPricing: row._count.bulkPriceTiers > 0,
    primaryImage: images[0] ?? null,
    category: row.category,
    vendor: row.vendor,
  };
}

export const catalogueRepository = {
  /**
   * Restricted to the canonical beauty-first taxonomy (M14.3) — see
   * prisma/reference-data.ts. A pre-existing top-level Category outside
   * that list (e.g. from an earlier, broader taxonomy on a previously
   * bootstrapped database) is never deleted, just no longer offered
   * through top-level discovery; direct links to it and its listings keep
   * working via findCategoryBySlug.
   */
  async listTopLevelCategoriesWithChildren(): Promise<PublicCategoryWithChildren[]> {
    const categories = await prisma.category.findMany({
      where: { parentCategoryId: null, slug: { in: CANONICAL_TOP_LEVEL_SLUGS } },
      select: { ...categorySelect, children: { select: categorySelect } },
      orderBy: { name: "asc" },
    });
    return categories;
  },

  async findCategoryBySlug(slug: string): Promise<PublicCategoryWithChildren | null> {
    return prisma.category.findUnique({
      where: { slug },
      select: { ...categorySelect, children: { select: categorySelect } },
    });
  },

  findCategoryById(id: string): Promise<PublicCategory | null> {
    return prisma.category.findUnique({ where: { id }, select: categorySelect });
  },

  /**
   * (M11.1) Paginated public listing grid — backs /shop, /shop/[category],
   * and vendor storefronts. `total` comes from a matching count() so
   * callers can render real page controls rather than a single hard-capped
   * page. Deterministic tie-breaker on `id` alongside `createdAt` keeps
   * page boundaries stable when multiple listings share a createdAt.
   */
  async listListings(
    filter: ListingFilter,
    pagination: { page: number; pageSize: number },
  ): Promise<{ rows: PublicListingSummary[]; total: number }> {
    const where = listingWhere(filter);
    const [rows, total] = await Promise.all([
      prisma.vendorListing.findMany({
        where,
        select: listingSummarySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(pagination.page, pagination.pageSize),
        take: pagination.pageSize,
      }),
      prisma.vendorListing.count({ where }),
    ]);

    return { rows: rows.map(toSummary), total };
  },

  /**
   * (M11.1) Deliberately NOT paginated — for callers that want a small,
   * bounded slice of listings without page/skip semantics (a homepage
   * carousel, an admin picker dropdown). Never use this for a public
   * browsing surface a shopper needs to page through; use `listListings`
   * for that.
   */
  async listListingsCapped(filter: ListingFilter, take: number): Promise<PublicListingSummary[]> {
    const rows = await prisma.vendorListing.findMany({
      where: listingWhere(filter),
      select: listingSummarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });

    return rows.map(toSummary);
  },

  async getListingById(id: string): Promise<PublicListingDetail | null> {
    const row = await prisma.vendorListing.findFirst({
      where: { id, ...PUBLIC_LISTING_WHERE },
      select: listingDetailSelect,
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      images: parseImages(row.images),
      specs: parseSpecs(row.specs),
      basePrice: row.basePrice.toNumber(),
      currency: row.currency,
      moq: row.moq,
      maxOq: row.maxOq,
      leadTimeDays: row.leadTimeDays,
      availableQuantity: row.availableQuantity,
      availabilityStatus: row.availabilityStatus,
      category: row.category,
      vendor: row.vendor,
      bulkPriceTiers: [],
    };
  },
};
