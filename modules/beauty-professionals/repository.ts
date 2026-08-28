import { prisma } from "../../lib/db";
import type { ServiceLocationMode } from "../../generated/prisma/client";
import { paginationSkip } from "../../lib/pagination";
import type { PublicBeautyProfessionalSummary, PublicPortfolioItem, VendorProfileView } from "./types";

/**
 * Opaque cursor for the public feed — same `createdAt desc, id desc`
 * base64 `<iso-timestamp>|<id>` shape as
 * modules/explore-posts/repository.ts's encodeExploreFeedCursor. A
 * malformed/tampered cursor is treated as "no cursor" — not an
 * authorization boundary.
 */
export function encodeProfileFeedCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

function decodeProfileFeedCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const separatorIndex = decoded.lastIndexOf("|");
    if (separatorIndex === -1) return null;
    const createdAt = new Date(decoded.slice(0, separatorIndex));
    const id = decoded.slice(separatorIndex + 1);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

/** Mirrors modules/explore-posts/repository.ts's own toImages() exactly — a Prisma Json column is opaque at the type level, so this is the one place malformed/non-array content is coerced to a safe empty list rather than trusted. */
function toImages(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

const publicSummarySelect = {
  id: true,
  displayName: true,
  bio: true,
  heroImage: true,
  createdAt: true,
  vendor: { select: { logoUrl: true, city: true, region: true, country: true } },
  specialtyCategorySlugs: true,
  services: {
    where: { active: true, startingPrice: { not: null } },
    select: { startingPrice: true, currency: true },
    orderBy: { startingPrice: "asc" as const },
    take: 1,
  },
} as const;

type PublicSummaryRow = {
  id: string;
  displayName: string;
  bio: string | null;
  heroImage: string | null;
  createdAt: Date;
  vendor: { logoUrl: string | null; city: string | null; region: string | null; country: string | null };
  specialtyCategorySlugs: string[];
  services: { startingPrice: unknown; currency: string }[];
};

async function toPublicSummary(row: PublicSummaryRow): Promise<PublicBeautyProfessionalSummary> {
  const location = [row.vendor.city, row.vendor.region, row.vendor.country].filter(Boolean).join(", ") || null;
  const specialties =
    row.specialtyCategorySlugs.length > 0
      ? await prisma.category.findMany({
          where: { slug: { in: row.specialtyCategorySlugs } },
          select: { id: true, name: true, slug: true },
        })
      : [];
  const cheapest = row.services[0];
  return {
    id: row.id,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.vendor.logoUrl,
    heroImage: row.heroImage,
    location,
    specialties,
    fromPrice: cheapest ? { amount: Number(cheapest.startingPrice).toFixed(2), currency: cheapest.currency } : null,
    createdAt: row.createdAt,
  };
}

const vendorProfileSelect = {
  id: true,
  status: true,
  displayName: true,
  bio: true,
  heroImage: true,
  specialtyCategorySlugs: true,
  locationMode: true,
  changesRequestedReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const beautyProfessionalsRepository = {
  /**
   * Public discovery feed — every profile with `status: APPROVED`, newest
   * first, cursor-paginated (M22 §21: "professional discovery must support
   * pagination", same cursor convention as Explore's feed). `categorySlug`
   * filters on `specialtyCategorySlugs` containing the slug.
   */
  async listPublicFeed(params: { categorySlug?: string; search?: string; cursor?: string }, pageSize: number): Promise<{
    rows: PublicSummaryRow[];
    nextCursor: string | null;
  }> {
    const decodedCursor = params.cursor ? decodeProfileFeedCursor(params.cursor) : null;

    const rows = await prisma.beautyProfessionalProfile.findMany({
      where: {
        status: "APPROVED",
        ...(params.categorySlug ? { specialtyCategorySlugs: { has: params.categorySlug } } : {}),
        ...(params.search ? { displayName: { contains: params.search, mode: "insensitive" } } : {}),
        ...(decodedCursor
          ? {
              OR: [
                { createdAt: { lt: decodedCursor.createdAt } },
                { createdAt: decodedCursor.createdAt, id: { lt: decodedCursor.id } },
              ],
            }
          : {}),
      },
      select: publicSummarySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const last = pageRows[pageRows.length - 1];
    return { rows: pageRows, nextCursor: hasMore && last ? encodeProfileFeedCursor(last) : null };
  },

  async toPublicSummaries(rows: PublicSummaryRow[]): Promise<PublicBeautyProfessionalSummary[]> {
    return Promise.all(rows.map(toPublicSummary));
  },

  /** Public detail — only an APPROVED profile is resolvable this way. */
  async findPublicById(id: string) {
    const row = await prisma.beautyProfessionalProfile.findFirst({
      where: { id, status: "APPROVED" },
      select: {
        ...publicSummarySelect,
        locationMode: true,
        vendorId: true,
        services: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            description: true,
            startingPrice: true,
            currency: true,
            category: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!row) return null;

    const portfolio = await prisma.explorePost.findMany({
      where: { vendorId: row.vendorId, visibility: "PUBLISHED" },
      select: { id: true, images: true, caption: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    // Same defensive `images` guard as modules/explore-posts/repository.ts's
    // own toImages() — a Json column is opaque at the type level, and this
    // endpoint must never 500 the entire profile because ONE portfolio
    // post's images happen to be malformed/non-array (M22.1 §3: a broken
    // image must not break the whole detail response).
    return {
      row,
      portfolio: portfolio.map((post) => ({ id: post.id, images: toImages(post.images), caption: post.caption })) as PublicPortfolioItem[],
    };
  },

  toPublicSummary,

  /** Lightweight existence+eligibility check for service-requests' create flow — avoids the heavier portfolio join findPublicById does. */
  findApprovedForRequest(id: string) {
    return prisma.beautyProfessionalProfile.findFirst({
      where: { id, status: "APPROVED" },
      select: { id: true, vendorId: true, displayName: true, locationMode: true },
    });
  },

  // --- Vendor (own profile) -------------------------------------------

  findForVendor(vendorId: string): Promise<VendorProfileView | null> {
    return prisma.beautyProfessionalProfile.findUnique({ where: { vendorId }, select: vendorProfileSelect });
  },

  createAndSubmit(vendorId: string, input: { displayName: string; bio: string | null; heroImage: string | null; specialtyCategorySlugs: string[]; locationMode: ServiceLocationMode }) {
    return prisma.beautyProfessionalProfile.create({
      data: { vendorId, ...input, status: "PENDING", submittedAt: new Date() },
      select: vendorProfileSelect,
    });
  },

  updateForVendor(vendorId: string, data: Record<string, unknown>) {
    return prisma.beautyProfessionalProfile.update({ where: { vendorId }, data, select: vendorProfileSelect });
  },

  /** Only a currently-APPROVED profile can be archived (unpublished). */
  async archiveForVendor(vendorId: string): Promise<boolean> {
    const result = await prisma.beautyProfessionalProfile.updateMany({
      where: { vendorId, status: "APPROVED" },
      data: { status: "ARCHIVED" },
    });
    return result.count > 0;
  },

  // --- Admin -----------------------------------------------------------

  async findPendingForAdminPaginated(page: number, pageSize: number) {
    const where = { status: "PENDING" as const, submittedAt: { not: null } };
    const [rows, total] = await Promise.all([
      prisma.beautyProfessionalProfile.findMany({
        where,
        select: { id: true, displayName: true, status: true, submittedAt: true, updatedAt: true, vendor: { select: { id: true, companyName: true } } },
        orderBy: { updatedAt: "asc" },
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.beautyProfessionalProfile.count({ where }),
    ]);
    return {
      rows: rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        status: row.status,
        vendorId: row.vendor.id,
        vendorName: row.vendor.companyName,
        submittedAt: row.submittedAt as Date,
        updatedAt: row.updatedAt,
      })),
      total,
    };
  },

  async findForAdmin(id: string) {
    const row = await prisma.beautyProfessionalProfile.findUnique({
      where: { id },
      select: { ...vendorProfileSelect, submittedAt: true, vendor: { select: { id: true, companyName: true } } },
    });
    if (!row) return null;
    return { ...row, vendorId: row.vendor.id, vendorName: row.vendor.companyName };
  },

  approve(id: string) {
    return prisma.beautyProfessionalProfile.update({
      where: { id },
      data: { status: "APPROVED", reviewedAt: new Date(), changesRequestedReason: null },
    });
  },

  requestChanges(id: string, reason: string) {
    return prisma.beautyProfessionalProfile.update({
      where: { id },
      data: { status: "CHANGES_REQUESTED", reviewedAt: new Date(), changesRequestedReason: reason },
    });
  },

  reject(id: string, reason: string) {
    return prisma.beautyProfessionalProfile.update({
      where: { id },
      data: { status: "REJECTED", reviewedAt: new Date(), changesRequestedReason: reason },
    });
  },
};
