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

/**
 * Explore (M21) discovery categories — the SAME `Category` table/taxonomy
 * mechanism as commerce above, not a second category universe. Four of
 * these slugs already exist as commerce categories and are reused as-is
 * (`wigs`, `makeup-cosmetics`, `lashes-brows`, `skincare` — a completed wig
 * install, makeup look, lash set, or skincare result maps directly onto the
 * existing product category). Three are new, added here only because no
 * existing commerce category represents that TYPE OF WORK: `hairstyling`
 * (a completed hairstyle/silk press/treatment — distinct from "Hair Care",
 * which is about care PRODUCTS, and from "Wigs", which is a product
 * category), `nails`, and `barbering` (neither has any commerce-category
 * equivalent at all). This list is exactly the 7-category set named in
 * MOBILE_V1_PLAN.md's M21 section.
 *
 * These 3 new rows are deliberately NOT added to CANONICAL_TOP_LEVEL_SLUGS
 * — they carry no VendorListings and must never appear in Shop's commerce
 * navigation; they exist solely as Category rows ExplorePost can reference.
 */
export const EXPLORE_CATEGORIES: CategorySeed[] = [
  { name: "Hairstyling", slug: "hairstyling" },
  { name: "Nails", slug: "nails" },
  { name: "Barbering", slug: "barbering" },
];

export const EXPLORE_CATEGORY_SLUGS = [
  "hairstyling",
  "wigs",
  "nails",
  "makeup-cosmetics",
  "lashes-brows",
  "barbering",
  "skincare",
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

  for (const category of EXPLORE_CATEGORIES) {
    await upsertCategory(category, null);
  }

  return { categoriesCreated, categoriesUpdated, categoriesUnchanged };
}
