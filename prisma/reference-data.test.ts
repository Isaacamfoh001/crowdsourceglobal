import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../lib/db";
import { bootstrapReferenceData, CATEGORIES } from "./reference-data";

function countCategories(): number {
  return CATEGORIES.reduce((total, category) => total + 1 + (category.children?.length ?? 0), 0);
}

/**
 * Integration tests against the real local Postgres dev database — same
 * conventions as modules/*\/service.test.ts. Categories are permanent,
 * production-safe reference data (not per-test fixtures), so nothing here
 * deletes them afterward — that mirrors exactly how this runs for real.
 */
describe("bootstrapReferenceData", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates every canonical category on an empty/fresh table", async () => {
    const result = await bootstrapReferenceData();

    expect(result.categoriesCreated + result.categoriesUpdated + result.categoriesUnchanged).toBe(
      countCategories(),
    );

    for (const category of CATEGORIES) {
      const parent = await prisma.category.findUnique({ where: { slug: category.slug } });
      expect(parent).not.toBeNull();
      expect(parent?.name).toBe(category.name);
      expect(parent?.parentCategoryId).toBeNull();

      for (const child of category.children ?? []) {
        const childRow = await prisma.category.findUnique({ where: { slug: child.slug } });
        expect(childRow).not.toBeNull();
        expect(childRow?.name).toBe(child.name);
        expect(childRow?.parentCategoryId).toBe(parent?.id);
      }
    }
  });

  it("is idempotent — running it again creates nothing new", async () => {
    await bootstrapReferenceData();
    const second = await bootstrapReferenceData();

    expect(second.categoriesCreated).toBe(0);
    expect(second.categoriesUpdated + second.categoriesUnchanged).toBe(countCategories());
  });

  it("vendor onboarding's category list is non-empty after bootstrap and contains every canonical slug", async () => {
    await bootstrapReferenceData();

    const topLevel = await prisma.category.findMany({ where: { parentCategoryId: null } });
    expect(topLevel.length).toBeGreaterThan(0);
    const topLevelSlugs = new Set(topLevel.map((c) => c.slug));
    for (const category of CATEGORIES) {
      expect(topLevelSlugs.has(category.slug)).toBe(true);
    }
  });

  it("never creates users, vendors, listings, orders, or any transactional/demo data", async () => {
    const vendorCreate = vi.spyOn(prisma.vendor, "create");
    const vendorListingCreate = vi.spyOn(prisma.vendorListing, "create");
    const userCreate = vi.spyOn(prisma.user, "create");
    const orderCreate = vi.spyOn(prisma.order, "create");
    const paymentCreate = vi.spyOn(prisma.payment, "create");
    const fulfilmentCreate = vi.spyOn(prisma.fulfilment, "create");
    const resolutionCreate = vi.spyOn(prisma.resolutionCase, "create");
    const settlementCreate = vi.spyOn(prisma.vendorSettlement, "create");
    const adminCreate = vi.spyOn(prisma.adminUser, "create");

    await bootstrapReferenceData();
    await bootstrapReferenceData(); // also cover the "already exists" path

    for (const spy of [
      vendorCreate,
      vendorListingCreate,
      userCreate,
      orderCreate,
      paymentCreate,
      fulfilmentCreate,
      resolutionCreate,
      settlementCreate,
      adminCreate,
    ]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
