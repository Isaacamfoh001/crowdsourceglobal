import { prisma } from "../../lib/db";
import type { PublicBulkPriceTier } from "./types";

const publicTierSelect = {
  id: true,
  minQuantity: true,
  maxQuantity: true,
  unitPrice: true,
} as const;

function toPublicTier(row: {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: { toNumber: () => number };
}): PublicBulkPriceTier {
  return {
    id: row.id,
    minQuantity: row.minQuantity,
    maxQuantity: row.maxQuantity,
    unitPrice: row.unitPrice.toNumber(),
  };
}

/**
 * Pricing-owned data access. Only BulkPriceTier is ever exposed here —
 * there is deliberately no accessor for VendorCostRule anywhere in this
 * module; it exists in the schema for the future payout milestone only.
 */
export const pricingRepository = {
  async findBulkTiersByListingId(listingId: string): Promise<PublicBulkPriceTier[]> {
    const rows = await prisma.bulkPriceTier.findMany({
      where: { listingId },
      select: publicTierSelect,
      orderBy: { minQuantity: "asc" },
    });
    return rows.map(toPublicTier);
  },

  /** Batch form for listing grids — avoids one query per card. */
  async findBulkTiersByListingIds(
    listingIds: string[],
  ): Promise<Map<string, PublicBulkPriceTier[]>> {
    if (listingIds.length === 0) {
      return new Map();
    }

    const rows = await prisma.bulkPriceTier.findMany({
      where: { listingId: { in: listingIds } },
      select: { listingId: true, ...publicTierSelect },
      orderBy: { minQuantity: "asc" },
    });

    const byListing = new Map<string, PublicBulkPriceTier[]>();
    for (const row of rows) {
      const tiers = byListing.get(row.listingId) ?? [];
      tiers.push(toPublicTier(row));
      byListing.set(row.listingId, tiers);
    }
    return byListing;
  },
};
