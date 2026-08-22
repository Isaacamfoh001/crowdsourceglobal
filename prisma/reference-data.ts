import { prisma } from "../lib/db";

/**
 * Canonical, production-safe reference/bootstrap data — the rows a
 * completely fresh database MUST contain for normal first-run workflows
 * (vendor onboarding's "what do you sell?" step, custom sourcing, catalogue
 * browsing, vendor listing creation) to function at all. This is the single
 * source of truth for that list — `prisma/seed.ts` (dev/demo data) imports
 * `CATEGORIES` from here rather than duplicating it, and
 * `scripts/bootstrap-reference-data.ts` calls `bootstrapReferenceData()`
 * directly so this can run against staging/production without touching any
 * demo Vendor/VendorListing/Order data.
 *
 * Contains ONLY canonical reference rows — no Users, Vendors, listings,
 * orders, or other transactional/demo data. See docs/deployment/railway.md
 * and the M13.3 staging-bootstrap report for the full rationale.
 */

type CategorySeed = {
  name: string;
  slug: string;
  children?: { name: string; slug: string }[];
};

export const CATEGORIES: CategorySeed[] = [
  {
    name: "Hair & Beauty Supplies",
    slug: "hair-beauty-supplies",
    children: [
      { name: "Hair Extensions & Wigs", slug: "hair-extensions-wigs" },
      { name: "Skincare & Cosmetics", slug: "skincare-cosmetics" },
    ],
  },
  {
    name: "Electronics & Accessories",
    slug: "electronics-accessories",
    children: [
      { name: "Phones & Tablets", slug: "phones-tablets" },
      { name: "Computer Accessories", slug: "computer-accessories" },
    ],
  },
  { name: "Office & Business Supplies", slug: "office-business-supplies" },
  { name: "Textiles & Fabrics", slug: "textiles-fabrics" },
  { name: "Home & Kitchen", slug: "home-kitchen" },
  { name: "Industrial & Safety Equipment", slug: "industrial-safety-equipment" },
  { name: "Packaging & Printing", slug: "packaging-printing" },
  { name: "Food & Beverage Supplies", slug: "food-beverage-supplies" },
];

export type ReferenceDataResult = {
  categoriesCreated: number;
  categoriesUpdated: number;
  categoriesUnchanged: number;
};

/**
 * Idempotent — upserts by each row's natural unique key (`slug`), never
 * delete-then-recreate. Safe to run any number of times, in any order,
 * against a database that already has real commerce activity: it only ever
 * touches `Category` rows, which nothing here deletes.
 */
export async function bootstrapReferenceData(): Promise<ReferenceDataResult> {
  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  let categoriesUnchanged = 0;

  const upsertCategory = async (
    seed: { name: string; slug: string },
    parentCategoryId: string | null,
  ) => {
    const existing = await prisma.category.findUnique({ where: { slug: seed.slug } });
    const category = await prisma.category.upsert({
      where: { slug: seed.slug },
      create: { name: seed.name, slug: seed.slug, parentCategoryId: parentCategoryId ?? undefined },
      update: { name: seed.name, parentCategoryId: parentCategoryId ?? undefined },
    });
    if (!existing) {
      categoriesCreated += 1;
    } else if (existing.name !== seed.name || existing.parentCategoryId !== parentCategoryId) {
      categoriesUpdated += 1;
    } else {
      categoriesUnchanged += 1;
    }
    return category;
  };

  for (const category of CATEGORIES) {
    const parent = await upsertCategory(category, null);
    for (const child of category.children ?? []) {
      await upsertCategory(child, parent.id);
    }
  }

  return { categoriesCreated, categoriesUpdated, categoriesUnchanged };
}
