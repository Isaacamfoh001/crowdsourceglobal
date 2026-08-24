import "dotenv/config";
import { prisma } from "../lib/db";
import { bootstrapReferenceData } from "./reference-data";

/**
 * Development/demo seed data only — not real vendors, products, or pricing.
 * Re-runnable: clears existing catalogue/pricing rows first (Identity/
 * CustomerProfile data from Better Auth is left untouched).
 *
 * Canonical Category rows are production-safe reference data, not demo
 * data — they live in ./reference-data.ts and `npm run
 * bootstrap:reference-data` seeds them independently of everything else in
 * this file. This script calls that same `bootstrapReferenceData()` for the
 * category step (rather than redefining the list) so a local dev database
 * ends up with an identical category tree either way, but never run this
 * file (prisma/seed.ts) against staging/production — everything below the
 * category step is demo Vendors/Listings.
 */

type VendorSeed = {
  companyName: string;
  storefrontSlug: string;
  description: string;
};

const VENDORS: VendorSeed[] = [
  {
    companyName: "Adepa Beauty Supplies",
    storefrontSlug: "adepa-beauty-supplies",
    description:
      "Wholesale hair supplier based in Accra, sourcing premium human hair, wigs, and bundles for salons and retailers across the region.",
  },
  {
    companyName: "Glow & Grace Cosmetics",
    storefrontSlug: "glow-and-grace-cosmetics",
    description:
      "Makeup, skincare, and lash supplier stocking everyday and professional-grade beauty products for retailers and beauty entrepreneurs.",
  },
  {
    companyName: "Pro Salon Essentials",
    storefrontSlug: "pro-salon-essentials",
    description:
      "Salon tools, styling equipment, and professional haircare supplier equipping salons and independent stylists nationwide.",
  },
];

type ListingSeed = {
  vendorSlug: string;
  categorySlug: string;
  title: string;
  description: string;
  specs?: Record<string, string>;
  basePrice: number;
  moq: number;
  maxOq?: number;
  leadTimeDays?: number;
  availableQuantity: number;
  availabilityStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "MADE_TO_ORDER";
  bulkTiers?: { minQuantity: number; maxQuantity: number | null; unitPrice: number }[];
  vendorSupplyCostRatio: number; // fraction of basePrice — private, never displayed
  marginValue: number; // percentage — private, never displayed
};

const LISTINGS: ListingSeed[] = [
  {
    vendorSlug: "adepa-beauty-supplies",
    categorySlug: "human-hair-bundles",
    title: "22-Inch Brazilian Human Hair Bundle",
    description:
      "100% unprocessed Brazilian human hair, double-wefted for durability. Natural black, sold as a single bundle.",
    specs: { Origin: "Brazil", Texture: "Straight", Weight: "100g" },
    basePrice: 480,
    moq: 1,
    leadTimeDays: 3,
    availableQuantity: 150,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 1, maxQuantity: 4, unitPrice: 480 },
      { minQuantity: 5, maxQuantity: 19, unitPrice: 450 },
      { minQuantity: 20, maxQuantity: 49, unitPrice: 420 },
      { minQuantity: 50, maxQuantity: null, unitPrice: 390 },
    ],
    vendorSupplyCostRatio: 0.62,
    marginValue: 35,
  },
  {
    vendorSlug: "adepa-beauty-supplies",
    categorySlug: "wigs",
    title: "Frontal Lace Closure Wig — 18 Inch",
    description:
      "Pre-plucked 13x4 lace frontal wig with baby hairs, glueless construction for everyday wear.",
    specs: { "Lace type": "13x4 frontal", Density: "150%" },
    basePrice: 650,
    moq: 1,
    availableQuantity: 40,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.6,
    marginValue: 38,
  },
  {
    vendorSlug: "adepa-beauty-supplies",
    categorySlug: "closures-frontals",
    title: "13x6 HD Lace Frontal — Natural Black",
    description: "Hand-tied HD lace frontal, pre-plucked with natural hairline, ear to ear.",
    specs: { "Lace type": "13x6 HD frontal", Texture: "Straight" },
    basePrice: 420,
    moq: 1,
    leadTimeDays: 5,
    availableQuantity: 60,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.6,
    marginValue: 34,
  },
  {
    vendorSlug: "adepa-beauty-supplies",
    categorySlug: "clip-ins-weaves",
    title: "Clip-In Hair Extensions Set (7 Pieces)",
    description: "120g clip-in extension set, seamless blend, reusable with proper care.",
    specs: { Weight: "120g", Pieces: "7" },
    basePrice: 260,
    moq: 2,
    availableQuantity: 90,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 2, maxQuantity: 9, unitPrice: 260 },
      { minQuantity: 10, maxQuantity: 29, unitPrice: 235 },
      { minQuantity: 30, maxQuantity: null, unitPrice: 210 },
    ],
    vendorSupplyCostRatio: 0.58,
    marginValue: 33,
  },
  {
    vendorSlug: "glow-and-grace-cosmetics",
    categorySlug: "skincare",
    title: "Shea Butter Body Cream 500ml",
    description:
      "Whipped shea butter cream made with unrefined shea, sold in bulk-friendly quantities for retailers.",
    specs: { Size: "500ml", "Skin type": "All skin types" },
    basePrice: 35,
    moq: 6,
    availableQuantity: 300,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 6, maxQuantity: 23, unitPrice: 35 },
      { minQuantity: 24, maxQuantity: 99, unitPrice: 30 },
      { minQuantity: 100, maxQuantity: null, unitPrice: 26 },
    ],
    vendorSupplyCostRatio: 0.55,
    marginValue: 40,
  },
  {
    vendorSlug: "glow-and-grace-cosmetics",
    categorySlug: "skincare",
    title: "Organic Black Soap Bar (Pack of 12)",
    description: "Traditional African black soap, handmade with cocoa pod ash and plantain skin.",
    basePrice: 60,
    moq: 1,
    availableQuantity: 20,
    availabilityStatus: "LOW_STOCK",
    vendorSupplyCostRatio: 0.58,
    marginValue: 30,
  },
  {
    vendorSlug: "glow-and-grace-cosmetics",
    categorySlug: "makeup-cosmetics",
    title: "Matte Liquid Lipstick Set (6 Shades)",
    description: "Long-wear, transfer-resistant liquid lipstick set in six everyday shades.",
    specs: { Shades: "6", Finish: "Matte" },
    basePrice: 150,
    moq: 3,
    availableQuantity: 180,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 3, maxQuantity: 11, unitPrice: 150 },
      { minQuantity: 12, maxQuantity: 47, unitPrice: 135 },
      { minQuantity: 48, maxQuantity: null, unitPrice: 118 },
    ],
    vendorSupplyCostRatio: 0.52,
    marginValue: 42,
  },
  {
    vendorSlug: "glow-and-grace-cosmetics",
    categorySlug: "makeup-cosmetics",
    title: "HD Pressed Powder Foundation",
    description: "Full-coverage pressed powder foundation, oil-control formula, wide shade range.",
    basePrice: 95,
    moq: 1,
    availableQuantity: 130,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.55,
    marginValue: 36,
  },
  {
    vendorSlug: "glow-and-grace-cosmetics",
    categorySlug: "lashes-brows",
    title: "5D Faux Mink Lashes (Pack of 10 Pairs)",
    description: "Reusable 5D faux mink lashes, lightweight band, natural volume finish.",
    specs: { Pairs: "10", Style: "5D volume" },
    basePrice: 180,
    moq: 2,
    availableQuantity: 220,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 2, maxQuantity: 9, unitPrice: 180 },
      { minQuantity: 10, maxQuantity: 29, unitPrice: 160 },
      { minQuantity: 30, maxQuantity: null, unitPrice: 140 },
    ],
    vendorSupplyCostRatio: 0.5,
    marginValue: 45,
  },
  {
    vendorSlug: "glow-and-grace-cosmetics",
    categorySlug: "lashes-brows",
    title: "Brow Lamination Kit",
    description: "Salon-style brow lamination kit with lifting, fixing, and nourishing serum steps.",
    basePrice: 210,
    moq: 1,
    leadTimeDays: 4,
    availableQuantity: 0,
    availabilityStatus: "OUT_OF_STOCK",
    vendorSupplyCostRatio: 0.55,
    marginValue: 35,
  },
  {
    vendorSlug: "pro-salon-essentials",
    categorySlug: "hair-care",
    title: "Sulfate-Free Shampoo & Conditioner Set (1L)",
    description: "Salon-grade sulfate-free shampoo and conditioner duo for color-treated hair.",
    specs: { Size: "1L each", Type: "Sulfate-free" },
    basePrice: 190,
    moq: 4,
    availableQuantity: 140,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 4, maxQuantity: 19, unitPrice: 190 },
      { minQuantity: 20, maxQuantity: 59, unitPrice: 170 },
      { minQuantity: 60, maxQuantity: null, unitPrice: 150 },
    ],
    vendorSupplyCostRatio: 0.6,
    marginValue: 30,
  },
  {
    vendorSlug: "pro-salon-essentials",
    categorySlug: "beauty-tools-accessories",
    title: "Ceramic Tourmaline Flat Iron",
    description: "Professional ceramic tourmaline flat iron with adjustable heat up to 230°C.",
    specs: { "Plate material": "Ceramic tourmaline", "Max heat": "230°C" },
    basePrice: 340,
    moq: 1,
    maxOq: 20,
    leadTimeDays: 6,
    availableQuantity: 45,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.63,
    marginValue: 28,
  },
  {
    vendorSlug: "pro-salon-essentials",
    categorySlug: "beauty-tools-accessories",
    title: "Edge Control & Styling Brush Set",
    description: "Strong-hold edge control paired with a dual-sided edge brush for finishing styles.",
    basePrice: 65,
    moq: 5,
    availableQuantity: 300,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 5, maxQuantity: 19, unitPrice: 65 },
      { minQuantity: 20, maxQuantity: null, unitPrice: 55 },
    ],
    vendorSupplyCostRatio: 0.5,
    marginValue: 40,
  },
  {
    vendorSlug: "pro-salon-essentials",
    categorySlug: "salon-professional",
    title: "Hooded Hair Steamer (Salon Stand)",
    description: "Standing hooded hair steamer for deep conditioning treatments, adjustable height.",
    basePrice: 2400,
    moq: 1,
    leadTimeDays: 14,
    availableQuantity: 6,
    availabilityStatus: "MADE_TO_ORDER",
    vendorSupplyCostRatio: 0.68,
    marginValue: 24,
  },
  {
    vendorSlug: "pro-salon-essentials",
    categorySlug: "salon-professional",
    title: "Barber Cape & Styling Chair Cover Set",
    description: "Water-resistant barber capes with snap closures, sold in salon-ready packs.",
    basePrice: 120,
    moq: 3,
    availableQuantity: 85,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.58,
    marginValue: 32,
  },
];

async function main() {
  console.log("Seeding catalogue data...");

  // Idempotent via upsert, not delete-then-recreate. Once real commerce
  // activity exists (Orders/Fulfilments referencing a seeded Vendor), a
  // blanket `vendor.deleteMany()` fails on the FK (correctly — Fulfilment
  // history must never silently cascade-delete) and leaves the DB
  // half-reset. Upserting by each model's natural key keeps re-running the
  // seed safe at any point in the app's lifecycle, in dev or otherwise.
  await bootstrapReferenceData();
  const allCategories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryIdBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
  console.log(`  Upserted ${categoryIdBySlug.size} categories (via bootstrapReferenceData).`);

  const vendorIdBySlug = new Map<string, string>();
  for (const vendor of VENDORS) {
    const created = await prisma.vendor.upsert({
      where: { storefrontSlug: vendor.storefrontSlug },
      create: {
        companyName: vendor.companyName,
        storefrontSlug: vendor.storefrontSlug,
        description: vendor.description,
        verificationStatus: "APPROVED",
      },
      update: {
        companyName: vendor.companyName,
        description: vendor.description,
      },
    });
    vendorIdBySlug.set(vendor.storefrontSlug, created.id);
  }
  console.log(`  Upserted ${vendorIdBySlug.size} vendors.`);

  let listingCount = 0;
  let bulkTierCount = 0;
  for (const listing of LISTINGS) {
    const vendorId = vendorIdBySlug.get(listing.vendorSlug);
    const categoryId = categoryIdBySlug.get(listing.categorySlug);
    if (!vendorId || !categoryId) {
      throw new Error(`Seed data error: unknown vendor/category for "${listing.title}"`);
    }

    // No natural unique key on VendorListing — match this seed run's
    // (vendorId, title) pair against what's already there instead.
    const existing = await prisma.vendorListing.findFirst({
      where: { vendorId, title: listing.title },
      select: { id: true },
    });

    const data = {
      vendorId,
      categoryId,
      title: listing.title,
      description: listing.description,
      specs: listing.specs ?? undefined,
      images: [],
      basePrice: listing.basePrice,
      moq: listing.moq,
      maxOq: listing.maxOq,
      leadTimeDays: listing.leadTimeDays,
      availableQuantity: listing.availableQuantity,
      availabilityStatus: listing.availabilityStatus,
      approvalStatus: "APPROVED" as const,
      listingStatus: "ACTIVE" as const,
    };

    const created = existing
      ? await prisma.vendorListing.update({ where: { id: existing.id }, data })
      : await prisma.vendorListing.create({ data });
    listingCount += 1;

    // BulkPriceTier/VendorCostRule are pure pricing input, never referenced
    // by Order/Fulfilment history — safe to fully replace on each run.
    await prisma.bulkPriceTier.deleteMany({ where: { listingId: created.id } });
    if (listing.bulkTiers) {
      await prisma.bulkPriceTier.createMany({
        data: listing.bulkTiers.map((tier) => ({
          listingId: created.id,
          minQuantity: tier.minQuantity,
          maxQuantity: tier.maxQuantity,
          unitPrice: tier.unitPrice,
        })),
      });
      bulkTierCount += listing.bulkTiers.length;
    }

    // Private commercial data — never read by any public code path.
    await prisma.vendorCostRule.upsert({
      where: { listingId: created.id },
      create: {
        listingId: created.id,
        vendorSupplyCost: Math.round(listing.basePrice * listing.vendorSupplyCostRatio * 100) / 100,
        marginRuleType: "PERCENTAGE",
        marginValue: listing.marginValue,
      },
      update: {
        vendorSupplyCost: Math.round(listing.basePrice * listing.vendorSupplyCostRatio * 100) / 100,
        marginValue: listing.marginValue,
      },
    });
  }
  console.log(`  Upserted ${listingCount} listings with ${bulkTierCount} bulk price tiers.`);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
