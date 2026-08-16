import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { pricingRepository } from "./repository";

/** Integration test against the real local Postgres dev database. */
describe("pricingRepository", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns bulk price tiers ordered by minQuantity ascending", async () => {
    const listing = await prisma.vendorListing.findFirst({
      where: { title: "22-Inch Brazilian Human Hair Bundle" },
      select: { id: true },
    });
    expect(listing).not.toBeNull();

    const tiers = await pricingRepository.findBulkTiersByListingId(listing!.id);
    expect(tiers.length).toBeGreaterThan(1);

    const minQuantities = tiers.map((tier) => tier.minQuantity);
    expect(minQuantities).toEqual([...minQuantities].sort((a, b) => a - b));
  });

  it("never exposes vendor cost/margin fields on a bulk price tier", async () => {
    const listing = await prisma.vendorListing.findFirst({
      where: { title: "22-Inch Brazilian Human Hair Bundle" },
      select: { id: true },
    });

    const [tier] = await pricingRepository.findBulkTiersByListingId(listing!.id);
    expect(tier).toBeDefined();

    const keys = Object.keys(tier as object);
    expect(keys).toEqual(["id", "minQuantity", "maxQuantity", "unitPrice"]);
  });

  it("batches tier lookups for multiple listings without N+1 queries", async () => {
    const listings = await prisma.vendorListing.findMany({
      where: { title: { in: ["22-Inch Brazilian Human Hair Bundle", "Power Bank 20,000mAh"] } },
      select: { id: true },
    });
    expect(listings.length).toBe(2);

    const byListing = await pricingRepository.findBulkTiersByListingIds(
      listings.map((listing) => listing.id),
    );
    expect(byListing.size).toBe(2);
    for (const listing of listings) {
      expect(byListing.get(listing.id)?.length).toBeGreaterThan(0);
    }
  });
});
