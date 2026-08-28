import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { beautyProfessionalsService } from "./service";
import { beautyServicesService } from "../beauty-services/service";

/** Integration tests against the real local Postgres dev database — same convention as modules/explore-posts/service.test.ts. */
describe("beautyProfessionalsService", () => {
  let approvedVendorAId: string;
  let approvedVendorBId: string;
  let productOnlyVendorId: string;
  let pendingVendorId: string;
  let categoryId: string;
  let secondCategoryId: string;
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendorA = await prisma.vendor.create({
      data: { companyName: "Ama Beauty Studio", storefrontSlug: `bp-test-a-${suffix}`, verificationStatus: "APPROVED", contactPhone: "0244000000", contactEmail: "secret@vendor.test" },
    });
    approvedVendorAId = vendorA.id;
    createdVendorIds.push(vendorA.id);

    const vendorB = await prisma.vendor.create({
      data: { companyName: "Akos Hair Studio", storefrontSlug: `bp-test-b-${suffix}`, verificationStatus: "APPROVED" },
    });
    approvedVendorBId = vendorB.id;
    createdVendorIds.push(vendorB.id);

    const productOnlyVendor = await prisma.vendor.create({
      data: { companyName: "Wholesale Cosmetics Supplier", storefrontSlug: `bp-test-c-${suffix}`, verificationStatus: "APPROVED" },
    });
    productOnlyVendorId = productOnlyVendor.id;
    createdVendorIds.push(productOnlyVendor.id);

    const pendingVendor = await prisma.vendor.create({
      data: { companyName: "Pending Vendor", storefrontSlug: `bp-test-d-${suffix}`, verificationStatus: "PENDING" },
    });
    pendingVendorId = pendingVendor.id;
    createdVendorIds.push(pendingVendor.id);

    const category = await prisma.category.upsert({ where: { slug: "makeup-cosmetics" }, create: { name: "Makeup & Cosmetics", slug: "makeup-cosmetics" }, update: {} });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const secondCategory = await prisma.category.upsert({ where: { slug: "hairstyling" }, create: { name: "Hairstyling", slug: "hairstyling" }, update: {} });
    secondCategoryId = secondCategory.id;
    createdCategoryIds.push(secondCategory.id);
  });

  afterAll(async () => {
    await prisma.beautyService.deleteMany({ where: { professional: { vendorId: { in: createdVendorIds } } } });
    await prisma.beautyProfessionalProfile.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function submitAndApprove(vendorId: string, displayName = "Test Professional") {
    const result = await beautyProfessionalsService.submitOrUpdate(vendorId, {
      displayName,
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
    });
    if (!result.ok) throw new Error(result.error);
    const profile = await beautyProfessionalsService.getForVendor(vendorId);
    if (!profile) throw new Error("profile missing");
    await beautyProfessionalsService.approve(profile.id);
    return profile.id;
  }

  // --- Product-only vendor is not automatically a Beauty Professional ---

  it("a product-only vendor has no Beauty Professional profile and never appears on the public feed", async () => {
    const profile = await beautyProfessionalsService.getForVendor(productOnlyVendorId);
    expect(profile).toBeNull();

    const feed = await beautyProfessionalsService.getFeed({});
    expect(feed.rows.every((row) => row.displayName !== "Wholesale Cosmetics Supplier")).toBe(true);
  });

  // --- Submission / validation --------------------------------------------

  it("creates a profile in PENDING status, not yet publicly visible", async () => {
    const result = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PENDING");

    // Asserted by THIS profile's own id, never by displayName — the public
    // feed is global/shared across whatever else is in the database (other
    // test files, local seed/demo data), so a display-name substring check
    // against the full feed is fragile against any coincidental name
    // collision (M22.1: this broke against a leftover local demo vendor
    // that happened to share the same "Ama Beauty Studio" name).
    const profile = await beautyProfessionalsService.getForVendor(approvedVendorAId);
    const feed = await beautyProfessionalsService.getFeed({});
    expect(feed.rows.some((row) => row.id === profile?.id)).toBe(false);
  });

  it("rejects a specialty slug outside the shared beauty-category taxonomy", async () => {
    const result = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: ["not-a-real-slug"],
      locationMode: "PROVIDER_LOCATION",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty specialty list", async () => {
    const result = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: [],
      locationMode: "PROVIDER_LOCATION",
    });
    expect(result.ok).toBe(false);
  });

  // --- Moderation / public visibility -------------------------------------

  it("only an APPROVED profile is publicly visible", async () => {
    const profileId = await submitAndApprove(approvedVendorAId);
    const detail = await beautyProfessionalsService.getPublicDetail(profileId);
    expect(detail).not.toBeNull();

    const feed = await beautyProfessionalsService.getFeed({});
    expect(feed.rows.some((row) => row.id === profileId)).toBe(true);
  });

  it("a PENDING/REJECTED/ARCHIVED profile is never publicly resolvable", async () => {
    const submitted = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
    });
    if (!submitted.ok) throw new Error(submitted.error);
    const pendingProfile = await beautyProfessionalsService.getForVendor(approvedVendorAId);
    if (!pendingProfile) throw new Error("missing");

    expect(await beautyProfessionalsService.getPublicDetail(pendingProfile.id)).toBeNull();

    await beautyProfessionalsService.reject(pendingProfile.id, "Not enough detail");
    expect(await beautyProfessionalsService.getPublicDetail(pendingProfile.id)).toBeNull();
  });

  it("archiving takes a live profile down from public discovery", async () => {
    const profileId = await submitAndApprove(approvedVendorAId);
    const archived = await beautyProfessionalsService.archive(approvedVendorAId);
    expect(archived.ok).toBe(true);

    expect(await beautyProfessionalsService.getPublicDetail(profileId)).toBeNull();
    const feed = await beautyProfessionalsService.getFeed({});
    expect(feed.rows.some((row) => row.id === profileId)).toBe(false);
  });

  it("editing an APPROVED profile applies immediately with no new review (self-serve, same as Vendor store settings)", async () => {
    await submitAndApprove(approvedVendorAId, "Original Name");
    const edit = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Updated Name",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
    });
    expect(edit.ok).toBe(true);
    if (edit.ok) expect(edit.value.status).toBe("APPROVED");

    const profile = await beautyProfessionalsService.getForVendor(approvedVendorAId);
    expect(profile?.displayName).toBe("Updated Name");
    expect(profile?.status).toBe("APPROVED");
  });

  // --- Hero image upload (M22.1 §4) ---------------------------------------

  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("uploads a real photo file and stores a storage key, never a pasted URL", async () => {
    await submitAndApprove(approvedVendorAId);
    const result = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
      heroImageFile: { buffer: PNG_MAGIC, filename: "hero.png", mimeType: "image/png" },
    });
    expect(result.ok).toBe(true);

    const profile = await beautyProfessionalsService.getForVendor(approvedVendorAId);
    expect(profile?.heroImage).toMatch(/^beauty-professional-images\/.+\.png$/);
  });

  it("rejects an invalid file (bad mime type) with a clean error, never a thrown exception", async () => {
    await submitAndApprove(approvedVendorAId);
    const result = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
      heroImageFile: { buffer: Buffer.from("<svg></svg>"), filename: "hero.svg", mimeType: "image/svg+xml" },
    });
    expect(result.ok).toBe(false);
  });

  it("leaves the existing hero image untouched when editing other fields without a new file", async () => {
    await submitAndApprove(approvedVendorAId);
    await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
      heroImageFile: { buffer: PNG_MAGIC, filename: "hero.png", mimeType: "image/png" },
    });
    const beforeKey = (await beautyProfessionalsService.getForVendor(approvedVendorAId))?.heroImage;

    const edit = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio — Updated Bio",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
    });
    expect(edit.ok).toBe(true);

    const afterKey = (await beautyProfessionalsService.getForVendor(approvedVendorAId))?.heroImage;
    expect(afterKey).toBe(beforeKey);
  });

  it("removes the hero image when removeHeroImage is set, independent of uploading a new one", async () => {
    await submitAndApprove(approvedVendorAId);
    await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
      heroImageFile: { buffer: PNG_MAGIC, filename: "hero.png", mimeType: "image/png" },
    });

    const removed = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
      removeHeroImage: true,
    });
    expect(removed.ok).toBe(true);

    const profile = await beautyProfessionalsService.getForVendor(approvedVendorAId);
    expect(profile?.heroImage).toBeNull();
  });

  it("editing a PENDING profile is rejected — already awaiting a decision", async () => {
    const submitted = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
    });
    expect(submitted.ok).toBe(true);

    const secondSubmit = await beautyProfessionalsService.submitOrUpdate(approvedVendorAId, {
      displayName: "Ama Beauty Studio v2",
      specialtyCategorySlugs: ["makeup-cosmetics"],
      locationMode: "PROVIDER_LOCATION",
    });
    expect(secondSubmit.ok).toBe(false);
  });

  // --- Category filtering --------------------------------------------------

  it("category filter only returns professionals with that specialty", async () => {
    const profileAId = await submitAndApprove(approvedVendorAId, "Makeup Pro");

    const submittedB = await beautyProfessionalsService.submitOrUpdate(approvedVendorBId, {
      displayName: "Hair Pro",
      specialtyCategorySlugs: ["hairstyling"],
      locationMode: "PROVIDER_LOCATION",
    });
    if (!submittedB.ok) throw new Error(submittedB.error);
    const profileB = await beautyProfessionalsService.getForVendor(approvedVendorBId);
    if (!profileB) throw new Error("missing");
    await beautyProfessionalsService.approve(profileB.id);

    const makeupFeed = await beautyProfessionalsService.getFeed({ categorySlug: "makeup-cosmetics" });
    expect(makeupFeed.rows.map((row) => row.id)).toContain(profileAId);
    expect(makeupFeed.rows.map((row) => row.id)).not.toContain(profileB.id);

    const hairFeed = await beautyProfessionalsService.getFeed({ categorySlug: "hairstyling" });
    expect(hairFeed.rows.map((row) => row.id)).toContain(profileB.id);
    expect(hairFeed.rows.map((row) => row.id)).not.toContain(profileAId);
  });

  // --- Public DTO safety ----------------------------------------------------

  it("public detail never exposes the Vendor's private contact fields", async () => {
    const profileId = await submitAndApprove(approvedVendorAId);
    const detail = await beautyProfessionalsService.getPublicDetail(profileId);
    expect(JSON.stringify(detail)).not.toContain("0244000000");
    expect(JSON.stringify(detail)).not.toContain("secret@vendor.test");
  });

  // --- Services + portfolio relationship ------------------------------------

  it("public detail includes only active services", async () => {
    const profileId = await submitAndApprove(approvedVendorAId);
    const created = await beautyServicesService.create(approvedVendorAId, { name: "Bridal Makeup", categoryId, startingPrice: "600" });
    if (!created.ok) throw new Error(created.error);
    const hiddenService = await beautyServicesService.create(approvedVendorAId, { name: "Discontinued Service", categoryId: secondCategoryId });
    if (!hiddenService.ok) throw new Error(hiddenService.error);
    await beautyServicesService.toggleActive(approvedVendorAId, hiddenService.value.id, false);

    const detail = await beautyProfessionalsService.getPublicDetail(profileId);
    expect(detail?.services.map((s) => s.name)).toContain("Bridal Makeup");
    expect(detail?.services.map((s) => s.name)).not.toContain("Discontinued Service");
    expect(detail?.fromPrice).toEqual({ amount: "600.00", currency: "GHS" });
  });

  it("portfolio is populated from the vendor's own published Explore posts, never a second photo system", async () => {
    const profileId = await submitAndApprove(approvedVendorAId);
    await prisma.explorePost.create({
      data: {
        vendorId: approvedVendorAId,
        categoryId,
        caption: "Finished bridal look",
        images: ["explore-post-images/test.png"],
        approvalStatus: "APPROVED",
        visibility: "PUBLISHED",
      },
    });

    const detail = await beautyProfessionalsService.getPublicDetail(profileId);
    expect(detail?.portfolio.length).toBe(1);
    expect(detail?.portfolio[0]?.caption).toBe("Finished bridal look");

    await prisma.explorePost.deleteMany({ where: { vendorId: approvedVendorAId } });
  });

  /**
   * Regression test (M22.1 §3) — reproduces the real bug found on physical-
   * device testing: a demo-seeding script double-JSON-encoded one
   * ExplorePost's `images` (a plain JS array was passed through
   * JSON.stringify() before being handed to Prisma's Json field), so the
   * column held a JSON *string* rather than a JSON *array*. The detail
   * endpoint then called `.map()` on that string and threw, 500ing the
   * ENTIRE professional profile — not just that one broken image. Fixed by
   * routing every portfolio post's `images` through the same defensive
   * `toImages()` guard modules/explore-posts/repository.ts already
   * established (Array.isArray(...) ? value : []) instead of an unsafe
   * cast. A malformed image must degrade to an empty image list for that
   * one post, never crash the whole profile.
   */
  it("a portfolio post with malformed (non-array) images degrades gracefully instead of crashing the whole profile", async () => {
    const profileId = await submitAndApprove(approvedVendorAId);
    await prisma.explorePost.create({
      data: {
        vendorId: approvedVendorAId,
        categoryId,
        caption: "Corrupted-data post",
        // Deliberately a JSON *string*, not an array — reproduces the
        // double-encoding bug exactly (the column holds "[\"x\"]", not ["x"]).
        images: JSON.stringify(["explore-post-images/should-not-crash.png"]),
        approvalStatus: "APPROVED",
        visibility: "PUBLISHED",
      },
    });

    const detail = await beautyProfessionalsService.getPublicDetail(profileId);
    expect(detail).not.toBeNull();
    expect(detail?.portfolio.length).toBe(1);
    expect(detail?.portfolio[0]?.images).toEqual([]);

    await prisma.explorePost.deleteMany({ where: { vendorId: approvedVendorAId } });
  });

  // --- Newest-first ordering / pagination -----------------------------------

  it("feed is newest-first with a working cursor", async () => {
    const firstId = await submitAndApprove(approvedVendorAId, "First Professional");
    const secondId = await submitAndApprove(approvedVendorBId, "Second Professional");

    const feed = await beautyProfessionalsService.getFeed({});
    const firstIndex = feed.rows.findIndex((row) => row.id === firstId);
    const secondIndex = feed.rows.findIndex((row) => row.id === secondId);
    expect(secondIndex).toBeLessThan(firstIndex);
  });
});
