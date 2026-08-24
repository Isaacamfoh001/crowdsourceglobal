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

/**
 * Beauty-first catalogue taxonomy (M14.3). CrownSourceGlobal's initial
 * commercial focus is beauty commerce and beauty-business sourcing — see
 * PROJECT.md and CLAUDE.md — so the customer-facing category tree reflects
 * that rather than a generic multi-category marketplace. Kept intentionally
 * small (7 top-level categories) rather than modelling every possible
 * beauty subcategory.
 *
 * This list also doubles as the discovery allowlist: only these top-level
 * slugs are surfaced by `listTopLevelCategoriesWithChildren` (see
 * CANONICAL_TOP_LEVEL_SLUGS below and modules/catalogue/repository.ts). Any
 * pre-existing Category row from an earlier, broader taxonomy (e.g. a
 * staging database bootstrapped before this milestone) is left untouched —
 * bootstrapReferenceData only ever upserts, never deletes — and any listing
 * still assigned to it stays reachable by direct link; it's simply no
 * longer offered through top-level navigation or the homepage.
 */
export const CATEGORIES: CategorySeed[] = [
  {
    name: "Hair & Wigs",
    slug: "hair-wigs",
    children: [
      { name: "Wigs", slug: "wigs" },
      { name: "Closures & Frontals", slug: "closures-frontals" },
    ],
  },
  {
    name: "Bundles & Extensions",
    slug: "bundles-extensions",
    children: [
      { name: "Human Hair Bundles", slug: "human-hair-bundles" },
      { name: "Clip-Ins & Weaves", slug: "clip-ins-weaves" },
    ],
  },
  { name: "Lashes & Brows", slug: "lashes-brows" },
  { name: "Makeup & Cosmetics", slug: "makeup-cosmetics" },
  {
    name: "Hair & Beauty Care",
    slug: "hair-beauty-care",
    children: [
      { name: "Skincare", slug: "skincare" },
      { name: "Hair Care", slug: "hair-care" },
    ],
  },
  { name: "Beauty Tools & Accessories", slug: "beauty-tools-accessories" },
  { name: "Salon & Professional", slug: "salon-professional" },
];

export const CANONICAL_TOP_LEVEL_SLUGS = CATEGORIES.map((category) => category.slug);

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
