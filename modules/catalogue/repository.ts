import { prisma } from "../../lib/db";
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
  category: { id: string; name: string; slug: string };
  vendor: { id: string; companyName: string; storefrontSlug: string };
  _count: { bulkPriceTiers: number };
};

function toSummary(row: SummaryRow): PublicListingSummary {
  return {
    id: row.id,
    title: row.title,
    basePrice: row.basePrice.toNumber(),
    currency: row.currency,
    moq: row.moq,
    availabilityStatus: row.availabilityStatus,
    hasBulkPricing: row._count.bulkPriceTiers > 0,
    category: row.category,
    vendor: row.vendor,
  };
}

export const catalogueRepository = {
  async listTopLevelCategoriesWithChildren(): Promise<PublicCategoryWithChildren[]> {
    const categories = await prisma.category.findMany({
      where: { parentCategoryId: null },
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

  async listListings(
    filter: ListingFilter,
    pagination: { take?: number } = {},
  ): Promise<PublicListingSummary[]> {
    const rows = await prisma.vendorListing.findMany({
      where: {
        ...PUBLIC_LISTING_WHERE,
        ...(filter.categoryIds && filter.categoryIds.length > 0
          ? { categoryId: { in: filter.categoryIds } }
          : {}),
        ...(filter.vendorId ? { vendorId: filter.vendorId } : {}),
        ...(filter.search
          ? {
              OR: [
                { title: { contains: filter.search, mode: "insensitive" as const } },
                { description: { contains: filter.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: listingSummarySelect,
      orderBy: { createdAt: "desc" },
      take: pagination.take ?? 48,
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
