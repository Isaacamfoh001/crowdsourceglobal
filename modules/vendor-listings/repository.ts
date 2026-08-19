import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { paginationSkip } from "../../lib/pagination";
import type { PendingChangesPayload } from "./types";

function toPlainNumber(value: { toNumber: () => number }): number {
  return value.toNumber();
}

const detailInclude = {
  bulkPriceTiers: { orderBy: { minQuantity: "asc" as const } },
};

function parsePendingChanges(value: unknown): PendingChangesPayload | null {
  if (!value || typeof value !== "object") return null;
  return value as PendingChangesPayload;
}

function toDetail(row: {
  id: string;
  title: string;
  description: string;
  images: unknown;
  specs: unknown;
  basePrice: { toNumber: () => number };
  currency: string;
  moq: number;
  maxOq: number | null;
  leadTimeDays: number | null;
  availableQuantity: number;
  availabilityStatus: string;
  approvalStatus: string;
  listingStatus: string;
  submittedAt: Date | null;
  changesRequestedReason: string | null;
  categoryId: string;
  pendingChanges: unknown;
  bulkPriceTiers: { id: string; minQuantity: number; maxQuantity: number | null; unitPrice: { toNumber: () => number } }[];
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    specs: (row.specs as Record<string, string> | null) ?? null,
    basePrice: toPlainNumber(row.basePrice),
    currency: row.currency,
    moq: row.moq,
    maxOq: row.maxOq,
    leadTimeDays: row.leadTimeDays,
    availableQuantity: row.availableQuantity,
    availabilityStatus: row.availabilityStatus,
    approvalStatus: row.approvalStatus,
    listingStatus: row.listingStatus,
    submittedAt: row.submittedAt,
    changesRequestedReason: row.changesRequestedReason,
    categoryId: row.categoryId,
    bulkPriceTiers: row.bulkPriceTiers.map((tier) => ({
      id: tier.id,
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      unitPrice: toPlainNumber(tier.unitPrice),
    })),
    pendingChanges: parsePendingChanges(row.pendingChanges),
  };
}

export const vendorListingsRepository = {
  async findSummariesForVendor(vendorId: string) {
    const rows = await prisma.vendorListing.findMany({
      where: { vendorId },
      select: {
        id: true,
        title: true,
        basePrice: true,
        currency: true,
        approvalStatus: true,
        listingStatus: true,
        availabilityStatus: true,
        availableQuantity: true,
        changesRequestedReason: true,
        pendingChanges: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      basePrice: toPlainNumber(row.basePrice),
      currency: row.currency,
      approvalStatus: row.approvalStatus,
      listingStatus: row.listingStatus,
      availabilityStatus: row.availabilityStatus,
      availableQuantity: row.availableQuantity,
      hasPendingChanges: row.pendingChanges !== null,
      changesRequestedReason: row.changesRequestedReason,
      updatedAt: row.updatedAt,
    }));
  },

  /**
   * (M11.1) Paginated variant for the vendor portal listings list page —
   * distinct from findSummariesForVendor, which app/vendor/portal/page.tsx
   * (the dashboard) still needs unbounded to compute its stat-card counts
   * across every listing, not just one page's worth.
   */
  async findSummariesForVendorPaginated(vendorId: string, page: number, pageSize: number) {
    const where = { vendorId };
    const [rows, total] = await Promise.all([
      prisma.vendorListing.findMany({
        where,
        select: {
          id: true,
          title: true,
          basePrice: true,
          currency: true,
          approvalStatus: true,
          listingStatus: true,
          availabilityStatus: true,
          availableQuantity: true,
          changesRequestedReason: true,
          pendingChanges: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.vendorListing.count({ where }),
    ]);
    return {
      rows: rows.map((row) => ({
        id: row.id,
        title: row.title,
        basePrice: toPlainNumber(row.basePrice),
        currency: row.currency,
        approvalStatus: row.approvalStatus,
        listingStatus: row.listingStatus,
        availabilityStatus: row.availabilityStatus,
        availableQuantity: row.availableQuantity,
        hasPendingChanges: row.pendingChanges !== null,
        changesRequestedReason: row.changesRequestedReason,
        updatedAt: row.updatedAt,
      })),
      total,
    };
  },

  async findDetailForVendor(vendorId: string, listingId: string) {
    const row = await prisma.vendorListing.findFirst({
      where: { id: listingId, vendorId },
      include: detailInclude,
    });
    return row ? toDetail(row) : null;
  },

  createDraft(vendorId: string, categoryId: string) {
    return prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Untitled listing",
        description: "",
        basePrice: 0,
        moq: 1,
        availableQuantity: 0,
      },
      select: { id: true },
    });
  },

  /** Ownership-scoped — only ever affects a row owned by `vendorId`. */
  async updateFieldsForVendor(vendorId: string, listingId: string, data: Record<string, unknown>) {
    const result = await prisma.vendorListing.updateMany({
      where: { id: listingId, vendorId },
      data,
    });
    return result.count > 0;
  },

  async replaceBulkTiersForVendor(
    vendorId: string,
    listingId: string,
    tiers: { minQuantity: number; maxQuantity: number | null; unitPrice: number }[],
  ) {
    const owned = await prisma.vendorListing.findFirst({ where: { id: listingId, vendorId }, select: { id: true } });
    if (!owned) return false;

    await prisma.$transaction([
      prisma.bulkPriceTier.deleteMany({ where: { listingId } }),
      ...(tiers.length > 0
        ? [
            prisma.bulkPriceTier.createMany({
              data: tiers.map((tier) => ({ ...tier, listingId })),
            }),
          ]
        : []),
    ]);
    return true;
  },

  // --- Admin -------------------------------------------------------------

  async findPendingForAdmin() {
    const rows = await prisma.vendorListing.findMany({
      // submittedAt distinguishes "vendor explicitly submitted this" from
      // "this is a never-submitted draft that merely defaults to PENDING" —
      // never surface the latter in the moderation queue.
      where: { approvalStatus: "PENDING", submittedAt: { not: null } },
      select: {
        id: true,
        title: true,
        basePrice: true,
        currency: true,
        approvalStatus: true,
        listingStatus: true,
        pendingChanges: true,
        submittedAt: true,
        updatedAt: true,
        vendor: { select: { id: true, companyName: true } },
      },
      orderBy: { updatedAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      basePrice: toPlainNumber(row.basePrice),
      currency: row.currency,
      approvalStatus: row.approvalStatus,
      listingStatus: row.listingStatus,
      isEdit: row.pendingChanges !== null,
      vendorId: row.vendor.id,
      vendorName: row.vendor.companyName,
      /// Non-null here — the `submittedAt: { not: null }` filter above
      /// guarantees it, but Prisma's generated type can't express that.
      submittedAt: row.submittedAt as Date,
      updatedAt: row.updatedAt,
    }));
  },

  /**
   * (M11.1) Paginated variant of findPendingForAdmin, for the admin listing
   * moderation queue page. findPendingForAdmin itself stays unbounded and
   * unpaginated — it's also used for admin-dashboard attention/summary
   * counts, which need the full pending set, not one page of it.
   */
  async findPendingForAdminPaginated(page: number, pageSize: number) {
    const where = { approvalStatus: "PENDING" as const, submittedAt: { not: null } };
    const [rows, total] = await Promise.all([
      prisma.vendorListing.findMany({
        where,
        select: {
          id: true,
          title: true,
          basePrice: true,
          currency: true,
          approvalStatus: true,
          listingStatus: true,
          pendingChanges: true,
          submittedAt: true,
          updatedAt: true,
          vendor: { select: { id: true, companyName: true } },
        },
        // Oldest-first — deliberate queue order so staff review the
        // longest-waiting submission first. Not a bug; do not flip to desc.
        orderBy: { updatedAt: "asc" },
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.vendorListing.count({ where }),
    ]);
    return {
      rows: rows.map((row) => ({
        id: row.id,
        title: row.title,
        basePrice: toPlainNumber(row.basePrice),
        currency: row.currency,
        approvalStatus: row.approvalStatus,
        listingStatus: row.listingStatus,
        isEdit: row.pendingChanges !== null,
        vendorId: row.vendor.id,
        vendorName: row.vendor.companyName,
        submittedAt: row.submittedAt as Date,
        updatedAt: row.updatedAt,
      })),
      total,
    };
  },

  async findForAdmin(listingId: string) {
    const row = await prisma.vendorListing.findUnique({
      where: { id: listingId },
      include: { ...detailInclude, vendor: { select: { id: true, companyName: true } } },
    });
    if (!row) return null;
    return { ...toDetail(row), vendorId: row.vendor.id, vendorName: row.vendor.companyName };
  },

  applyApprovalAndActivate(listingId: string, fields: Record<string, unknown> | null, tiers: { minQuantity: number; maxQuantity: number | null; unitPrice: number }[] | null) {
    return prisma.$transaction(async (tx) => {
      if (fields) {
        await tx.vendorListing.update({
          where: { id: listingId },
          data: { ...fields, approvalStatus: "APPROVED", listingStatus: "ACTIVE", pendingChanges: Prisma.JsonNull, changesRequestedReason: null },
        });
      } else {
        await tx.vendorListing.update({
          where: { id: listingId },
          data: { approvalStatus: "APPROVED", listingStatus: "ACTIVE", pendingChanges: Prisma.JsonNull, changesRequestedReason: null },
        });
      }
      if (tiers) {
        await tx.bulkPriceTier.deleteMany({ where: { listingId } });
        if (tiers.length > 0) {
          await tx.bulkPriceTier.createMany({ data: tiers.map((tier) => ({ ...tier, listingId })) });
        }
      }
    });
  },

  requestChanges(listingId: string, reason: string) {
    return prisma.vendorListing.update({
      where: { id: listingId },
      data: { approvalStatus: "CHANGES_REQUESTED", changesRequestedReason: reason },
    });
  },

  /** First-time-submission rejection — listing stays DRAFT/hidden. */
  reject(listingId: string, reason: string) {
    return prisma.vendorListing.update({
      where: { id: listingId },
      data: { approvalStatus: "REJECTED", changesRequestedReason: reason },
    });
  },

  /** Edit-to-a-live-listing rejection — discard the proposal, keep the live version. */
  discardPendingChanges(listingId: string) {
    return prisma.vendorListing.update({
      where: { id: listingId },
      data: { approvalStatus: "APPROVED", pendingChanges: Prisma.JsonNull, changesRequestedReason: null },
    });
  },
};
