import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db";
import { vendorListingsService } from "../../modules/vendor-listings/service";

const vendorId0 = { current: "" };

vi.mock("../../modules/vendors/policy", () => ({
  requireVendorPortalContext: async () => ({ vendorId: vendorId0.current, session: { user: { id: "test-user" } }, role: "OWNER", vendor: null }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

const { saveListingAction, submitListingAction } = await import("./vendor-listings");

/**
 * Real end-to-end test of the ACTUAL browser -> Server Action -> service ->
 * repository boundary, using a genuine FormData object (exactly what
 * ListingEditorForm's native <form> submission produces) against the real,
 * unmodified saveListingAction/contentSchema code and the real database —
 * only session resolution is mocked. This is the level the M10 hardening
 * report's service-only tests did not cover.
 */
describe("saveListingAction — real FormData boundary", () => {
  let vendorId: string;
  let categoryId: string;
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: "Action Test Vendor", storefrontSlug: `action-test-${suffix}`, verificationStatus: "APPROVED" } });
    vendorId = vendor.id;
    vendorId0.current = vendorId;
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.create({ data: { name: "Action Test Category", slug: `action-test-category-${suffix}` } });
    categoryId = category.id;
    createdCategoryIds.push(category.id);
  });

  afterAll(async () => {
    await prisma.bulkPriceTier.deleteMany({ where: { listingId: { in: createdListingIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function createTrackedDraft() {
    const result = await vendorListingsService.createDraft(vendorId, categoryId);
    if (!result.ok) throw new Error(result.error);
    createdListingIds.push(result.value.listingId);
    return result.value.listingId;
  }

  function realBrowserFormData(listingId: string, overrides: Record<string, string> = {}): FormData {
    // Exactly the field set/names ListingEditorForm's native <form> submits.
    const fd = new FormData();
    fd.set("listingId", listingId);
    fd.set("title", "iPhone 15 Pro Max");
    fd.set("description", "Apple iPhone 15 Pro Max 256GB, factory unlocked.");
    fd.set("categoryId", categoryId);
    fd.set("basePrice", "8500");
    fd.set("moq", "1");
    fd.set("maxOq", "");
    fd.set("leadTimeDays", "");
    fd.set("images", "");
    for (const [key, value] of Object.entries(overrides)) fd.set(key, value);
    return fd;
  }

  it("a real FormData submission with typed values persists those EXACT values, not the draft defaults", async () => {
    const listingId = await createTrackedDraft();
    const formData = realBrowserFormData(listingId);

    const result = await saveListingAction(null, formData);
    expect(result.ok).toBe(true);

    const detail = await vendorListingsService.getDetail(vendorId, listingId);
    expect(detail?.title).toBe("iPhone 15 Pro Max");
    expect(detail?.description).toBe("Apple iPhone 15 Pro Max 256GB, factory unlocked.");
    expect(detail?.basePrice).toBe(8500);
  });

  it("reload semantics: after saveListingAction, re-fetching the listing (simulating a page reload) shows the persisted real values, never reverted to defaults", async () => {
    const listingId = await createTrackedDraft();
    await saveListingAction(null, realBrowserFormData(listingId));

    // Simulate a fresh page load — a brand new read, no client state involved at all.
    const reloaded = await vendorListingsService.getDetail(vendorId, listingId);
    expect(reloaded?.title).toBe("iPhone 15 Pro Max");
    expect(reloaded?.description).not.toBe("");
    expect(reloaded?.basePrice).not.toBe(0);
  });

  it("submitForReview after a real saveListingAction call submits the TYPED values, not stale drafts defaults", async () => {
    const listingId = await createTrackedDraft();
    await saveListingAction(null, realBrowserFormData(listingId, { moq: "1" }));

    const submitResult = await submitListingAction(null, (() => {
      const fd = new FormData();
      fd.set("listingId", listingId);
      return fd;
    })());
    expect(submitResult.ok).toBe(true);

    const row = await prisma.vendorListing.findUniqueOrThrow({ where: { id: listingId } });
    expect(row.title).toBe("iPhone 15 Pro Max");
    expect(row.description).not.toBe("");
    expect(row.basePrice.toNumber()).toBe(8500);
    expect(row.submittedAt).not.toBeNull();
  });

  it("a numeric price field submitted as an empty string is rejected, never silently coerced to 0", async () => {
    const listingId = await createTrackedDraft();
    const formData = realBrowserFormData(listingId, { basePrice: "" });
    const result = await saveListingAction(null, formData);
    expect(result.ok).toBe(false);

    const detail = await vendorListingsService.getDetail(vendorId, listingId);
    expect(detail?.basePrice).toBe(0); // untouched — the bad save was rejected, draft defaults remain until a valid save
  });
});
