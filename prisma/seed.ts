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
      "Wholesale hair and skincare supplier based in Accra, sourcing premium human hair and natural beauty products for salons and retailers across the region.",
  },
  {
    companyName: "Kumasi Electronics Hub",
    storefrontSlug: "kumasi-electronics-hub",
    description:
      "Consumer electronics and computer accessories distributor supplying retailers, offices, and IT resellers from our Kumasi warehouse.",
  },
  {
    companyName: "Golden Textiles Ltd",
    storefrontSlug: "golden-textiles-ltd",
    description:
      "Fabric wholesaler specializing in Ankara prints, handwoven Kente, and plain cotton textiles for tailors, designers, and bulk buyers.",
  },
  {
    companyName: "Accra Office Essentials",
    storefrontSlug: "accra-office-essentials",
    description:
      "Office furniture and stationery supplier serving businesses and institutions with everyday supplies and bulk procurement orders.",
  },
  {
    companyName: "Nova Packaging Co.",
    storefrontSlug: "nova-packaging-co",
    description:
      "Packaging, printing, and industrial safety equipment supplier helping businesses ship, brand, and protect their operations.",
  },
  {
    companyName: "Bright Home Living",
    storefrontSlug: "bright-home-living",
    description:
      "Homeware and pantry supplier bringing quality kitchenware and food staples to households and hospitality businesses.",
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
    categorySlug: "hair-extensions-wigs",
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
    categorySlug: "hair-extensions-wigs",
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
    categorySlug: "skincare-cosmetics",
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
    vendorSlug: "adepa-beauty-supplies",
    categorySlug: "skincare-cosmetics",
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
    vendorSlug: "kumasi-electronics-hub",
    categorySlug: "phones-tablets",
    title: "Wireless Bluetooth Earbuds — Pro Series",
    description: "Active noise-cancelling true wireless earbuds with 30-hour case battery life.",
    specs: { Battery: "30 hours (with case)", Connectivity: "Bluetooth 5.3" },
    basePrice: 120,
    moq: 1,
    availableQuantity: 200,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 1, maxQuantity: 9, unitPrice: 120 },
      { minQuantity: 10, maxQuantity: 49, unitPrice: 105 },
      { minQuantity: 50, maxQuantity: null, unitPrice: 90 },
    ],
    vendorSupplyCostRatio: 0.5,
    marginValue: 45,
  },
  {
    vendorSlug: "kumasi-electronics-hub",
    categorySlug: "phones-tablets",
    title: "65W USB-C Fast Charger",
    description: "GaN fast charger compatible with laptops, tablets, and phones via USB-C PD.",
    basePrice: 85,
    moq: 2,
    availableQuantity: 500,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.55,
    marginValue: 35,
  },
  {
    vendorSlug: "kumasi-electronics-hub",
    categorySlug: "computer-accessories",
    title: "27-Inch Full HD Monitor",
    description: "27-inch IPS monitor, 75Hz refresh rate, HDMI and DisplayPort inputs.",
    specs: { Resolution: "1920x1080", "Panel type": "IPS", "Refresh rate": "75Hz" },
    basePrice: 1450,
    moq: 1,
    maxOq: 10,
    leadTimeDays: 7,
    availableQuantity: 15,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.68,
    marginValue: 25,
  },
  {
    vendorSlug: "kumasi-electronics-hub",
    categorySlug: "computer-accessories",
    title: "Mechanical Keyboard — RGB Backlit",
    description: "Hot-swappable mechanical keyboard with per-key RGB and blue tactile switches.",
    basePrice: 320,
    moq: 1,
    availableQuantity: 0,
    availabilityStatus: "OUT_OF_STOCK",
    vendorSupplyCostRatio: 0.6,
    marginValue: 30,
  },
  {
    vendorSlug: "kumasi-electronics-hub",
    categorySlug: "phones-tablets",
    title: "Power Bank 20,000mAh",
    description: "High-capacity power bank with dual USB-A and USB-C fast-charge output.",
    basePrice: 95,
    moq: 5,
    availableQuantity: 250,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 5, maxQuantity: 19, unitPrice: 95 },
      { minQuantity: 20, maxQuantity: 99, unitPrice: 82 },
      { minQuantity: 100, maxQuantity: null, unitPrice: 70 },
    ],
    vendorSupplyCostRatio: 0.52,
    marginValue: 38,
  },
  {
    vendorSlug: "golden-textiles-ltd",
    categorySlug: "textiles-fabrics",
    title: "Ankara Wax Print Fabric (6 Yards)",
    description: "Vibrant Ankara wax print, 100% cotton, sold in 6-yard lengths for tailoring.",
    specs: { Material: "100% cotton", Length: "6 yards" },
    basePrice: 180,
    moq: 1,
    availableQuantity: 90,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 1, maxQuantity: 9, unitPrice: 180 },
      { minQuantity: 10, maxQuantity: 49, unitPrice: 160 },
      { minQuantity: 50, maxQuantity: null, unitPrice: 145 },
    ],
    vendorSupplyCostRatio: 0.6,
    marginValue: 32,
  },
  {
    vendorSlug: "golden-textiles-ltd",
    categorySlug: "textiles-fabrics",
    title: "Kente Cloth — Handwoven (Premium)",
    description:
      "Authentic handwoven Kente cloth from local weavers, made to order in traditional patterns.",
    specs: { Weave: "Handwoven", Origin: "Ghana" },
    basePrice: 950,
    moq: 1,
    leadTimeDays: 14,
    availableQuantity: 12,
    availabilityStatus: "MADE_TO_ORDER",
    vendorSupplyCostRatio: 0.65,
    marginValue: 28,
  },
  {
    vendorSlug: "golden-textiles-ltd",
    categorySlug: "textiles-fabrics",
    title: "Plain Cotton Fabric Roll (50 Yards)",
    description: "Undyed plain cotton fabric roll, suitable for dyeing, printing, or lining.",
    basePrice: 620,
    moq: 1,
    availableQuantity: 35,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.63,
    marginValue: 27,
  },
  {
    vendorSlug: "accra-office-essentials",
    categorySlug: "office-business-supplies",
    title: "A4 Copy Paper (Box of 5 Reams)",
    description: "80gsm A4 copy paper, 500 sheets per ream, 5 reams per box.",
    specs: { Weight: "80gsm", "Sheets per ream": "500" },
    basePrice: 210,
    moq: 1,
    availableQuantity: 400,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 1, maxQuantity: 4, unitPrice: 210 },
      { minQuantity: 5, maxQuantity: 19, unitPrice: 195 },
      { minQuantity: 20, maxQuantity: null, unitPrice: 175 },
    ],
    vendorSupplyCostRatio: 0.7,
    marginValue: 22,
  },
  {
    vendorSlug: "accra-office-essentials",
    categorySlug: "office-business-supplies",
    title: "Ergonomic Office Chair — Mesh Back",
    description: "Adjustable-height office chair with breathable mesh back and lumbar support.",
    basePrice: 780,
    moq: 1,
    leadTimeDays: 5,
    availableQuantity: 25,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.6,
    marginValue: 33,
  },
  {
    vendorSlug: "accra-office-essentials",
    categorySlug: "office-business-supplies",
    title: "Branded Notebooks (Pack of 50)",
    description: "Custom-branded hardcover notebooks, A5 size, minimum order applies for branding.",
    basePrice: 340,
    moq: 1,
    leadTimeDays: 10,
    availableQuantity: 60,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.58,
    marginValue: 34,
  },
  {
    vendorSlug: "accra-office-essentials",
    categorySlug: "office-business-supplies",
    title: "Stainless Steel Filing Cabinet — 4 Drawer",
    description: "Lockable 4-drawer filing cabinet in powder-coated steel.",
    basePrice: 1100,
    moq: 1,
    availableQuantity: 8,
    availabilityStatus: "LOW_STOCK",
    vendorSupplyCostRatio: 0.66,
    marginValue: 26,
  },
  {
    vendorSlug: "nova-packaging-co",
    categorySlug: "packaging-printing",
    title: "Corrugated Shipping Boxes (Medium, Pack of 25)",
    description: "Double-wall corrugated boxes, medium size, suitable for retail shipping.",
    specs: { Size: "30x20x20cm", Ply: "Double wall" },
    basePrice: 145,
    moq: 2,
    availableQuantity: 600,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 2, maxQuantity: 9, unitPrice: 145 },
      { minQuantity: 10, maxQuantity: 49, unitPrice: 128 },
      { minQuantity: 50, maxQuantity: null, unitPrice: 110 },
    ],
    vendorSupplyCostRatio: 0.6,
    marginValue: 30,
  },
  {
    vendorSlug: "nova-packaging-co",
    categorySlug: "packaging-printing",
    title: "Custom Printed Poly Mailers (Pack of 100)",
    description: "Branded poly mailers with custom print, tamper-evident seal strip.",
    basePrice: 220,
    moq: 1,
    leadTimeDays: 12,
    availableQuantity: 80,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.55,
    marginValue: 36,
  },
  {
    vendorSlug: "nova-packaging-co",
    categorySlug: "industrial-safety-equipment",
    title: "Industrial Safety Gloves (Pack of 12 Pairs)",
    description: "Cut-resistant work gloves with reinforced palm grip, sold by the dozen.",
    basePrice: 95,
    moq: 3,
    availableQuantity: 220,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 3, maxQuantity: 9, unitPrice: 95 },
      { minQuantity: 10, maxQuantity: 49, unitPrice: 84 },
      { minQuantity: 50, maxQuantity: null, unitPrice: 72 },
    ],
    vendorSupplyCostRatio: 0.58,
    marginValue: 32,
  },
  {
    vendorSlug: "nova-packaging-co",
    categorySlug: "industrial-safety-equipment",
    title: "Reflective Safety Vests (Pack of 10)",
    description: "High-visibility reflective safety vests, one-size-fits-most, class 2 rated.",
    basePrice: 260,
    moq: 1,
    availableQuantity: 45,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.6,
    marginValue: 29,
  },
  {
    vendorSlug: "bright-home-living",
    categorySlug: "home-kitchen",
    title: "Non-Stick Cookware Set (7 Pieces)",
    description: "7-piece non-stick cookware set with tempered glass lids and heat-resistant handles.",
    basePrice: 480,
    moq: 1,
    availableQuantity: 30,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.62,
    marginValue: 31,
  },
  {
    vendorSlug: "bright-home-living",
    categorySlug: "home-kitchen",
    title: "Stainless Steel Water Dispenser — 20L",
    description: "Countertop water dispenser with hot and cold taps, 20-litre capacity.",
    basePrice: 890,
    moq: 1,
    leadTimeDays: 6,
    availableQuantity: 18,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.64,
    marginValue: 27,
  },
  {
    vendorSlug: "bright-home-living",
    categorySlug: "food-beverage-supplies",
    title: "Roasted Cashew Nuts (Bulk 10kg Bag)",
    description: "Locally sourced roasted and salted cashew nuts, packed for wholesale distribution.",
    specs: { Weight: "10kg", "Shelf life": "6 months" },
    basePrice: 340,
    moq: 1,
    availableQuantity: 55,
    availabilityStatus: "IN_STOCK",
    bulkTiers: [
      { minQuantity: 1, maxQuantity: 4, unitPrice: 340 },
      { minQuantity: 5, maxQuantity: 19, unitPrice: 310 },
      { minQuantity: 20, maxQuantity: null, unitPrice: 275 },
    ],
    vendorSupplyCostRatio: 0.68,
    marginValue: 24,
  },
  {
    vendorSlug: "bright-home-living",
    categorySlug: "food-beverage-supplies",
    title: "Cold-Pressed Coconut Oil (5L Jug)",
    description: "Unrefined cold-pressed coconut oil, suitable for cooking and cosmetic use.",
    basePrice: 175,
    moq: 2,
    availableQuantity: 70,
    availabilityStatus: "IN_STOCK",
    vendorSupplyCostRatio: 0.6,
    marginValue: 29,
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
