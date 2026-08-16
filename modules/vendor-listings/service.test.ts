import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { vendorListingsService } from "./service";

/** Integration tests against the real local Postgres dev database. */
describe("vendorListingsService", () => {
  let vendorAId: string;
  let vendorBId: string;
  let categoryId: string;
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];

  const validContent = {
    title: "22 Inch Human Hair Bundle",
    description: "Premium quality human hair bundle sourced ethically.",
    basePrice: 480,
    moq: 1,
    images: [] as string[],
  };

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendorA = await prisma.vendor.create({
      data: { companyName: "Listing Test Vendor A", storefrontSlug: `listing-test-a-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorAId = vendorA.id;
    createdVendorIds.push(vendorA.id);

    const vendorB = await prisma.vendor.create({
      data: { companyName: "Listing Test Vendor B", storefrontSlug: `listing-test-b-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorBId = vendorB.id;
    createdVendorIds.push(vendorB.id);

    const category = await prisma.category.create({
      data: { name: "Listing Test Category", slug: `listing-test-category-${suffix}` },
    });
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

  async function createTrackedDraft(vendorId: string) {
    const result = await vendorListingsService.createDraft(vendorId, categoryId);
    if (!result.ok) throw new Error(result.error);
    createdListingIds.push(result.value.listingId);
    return result.value.listingId;
  }

  it("creates a draft that is not publicly visible", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    const row = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(row?.listingStatus).toBe("DRAFT");

    const publiclyVisible = await prisma.vendorListing.findFirst({
      where: { id: listingId, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    expect(publiclyVisible).toBeNull();
  });

  it("allows editing a draft directly, in place", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    const result = await vendorListingsService.saveContent(vendorAId, listingId, {
      ...validContent,
      categoryId,
    }, []);
    expect(result.ok).toBe(true);

    const detail = await vendorListingsService.getDetail(vendorAId, listingId);
    expect(detail?.title).toBe(validContent.title);
  });

  it("rejects mutations for a listing owned by a different vendor", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    const result = await vendorListingsService.saveContent(vendorBId, listingId, { ...validContent, categoryId }, []);
    expect(result.ok).toBe(false);

    const detail = await vendorListingsService.getDetail(vendorBId, listingId);
    expect(detail).toBeNull(); // vendor B cannot even read vendor A's listing
  });

  it("validates bulk pricing tiers — rejects overlapping tiers", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    const result = await vendorListingsService.saveContent(
      vendorAId,
      listingId,
      { ...validContent, categoryId },
      [
        { minQuantity: 1, maxQuantity: 10, unitPrice: 480 },
        { minQuantity: 5, maxQuantity: 20, unitPrice: 450 }, // overlaps the first tier
      ],
    );
    expect(result.ok).toBe(false);
  });

  it("accepts valid, non-overlapping bulk pricing tiers", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    const result = await vendorListingsService.saveContent(
      vendorAId,
      listingId,
      { ...validContent, categoryId },
      [
        { minQuantity: 1, maxQuantity: 9, unitPrice: 480 },
        { minQuantity: 10, maxQuantity: null, unitPrice: 420 },
      ],
    );
    expect(result.ok).toBe(true);
    const detail = await vendorListingsService.getDetail(vendorAId, listingId);
    expect(detail?.bulkPriceTiers.length).toBe(2);
  });

  it("submits a draft for review, moving it to PENDING while staying non-public", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId }, []);
    const result = await vendorListingsService.submitForReview(vendorAId, listingId);
    expect(result.ok).toBe(true);

    const detail = await vendorListingsService.getDetail(vendorAId, listingId);
    expect(detail?.approvalStatus).toBe("PENDING");
    expect(detail?.listingStatus).toBe("DRAFT");

    // Locked from further direct edits while awaiting a decision.
    const editAttempt = await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId }, []);
    expect(editAttempt.ok).toBe(false);
  });

  it("approval makes the listing publicly visible, matching existing catalogue query shape", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId }, []);
    await vendorListingsService.submitForReview(vendorAId, listingId);

    const approval = await vendorListingsService.approve(listingId);
    expect(approval.ok).toBe(true);

    const publiclyVisible = await prisma.vendorListing.findFirst({
      where: { id: listingId, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    expect(publiclyVisible).not.toBeNull();
  });

  it("an approved listing's material edit stages into pendingChanges without touching the live version", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId }, []);
    await vendorListingsService.submitForReview(vendorAId, listingId);
    await vendorListingsService.approve(listingId);

    const proposeResult = await vendorListingsService.saveContent(
      vendorAId,
      listingId,
      { ...validContent, categoryId, title: "Renamed listing title", basePrice: 999 },
      [],
    );
    expect(proposeResult.ok).toBe(true);

    // Live public row is untouched.
    const live = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(live?.title).toBe(validContent.title);
    expect(live?.listingStatus).toBe("ACTIVE");
    expect(live?.approvalStatus).toBe("APPROVED");
    expect(live?.pendingChanges).not.toBeNull();

    await vendorListingsService.submitForReview(vendorAId, listingId);
    const afterSubmit = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(afterSubmit?.approvalStatus).toBe("PENDING");
    expect(afterSubmit?.listingStatus).toBe("ACTIVE"); // still live/public during re-review
    expect(afterSubmit?.title).toBe(validContent.title); // still the OLD title publicly

    const approveEdit = await vendorListingsService.approve(listingId);
    expect(approveEdit.ok).toBe(true);
    const afterApproval = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(afterApproval?.title).toBe("Renamed listing title");
    expect(afterApproval?.pendingChanges).toBeNull();
  });

  it("admin request-changes on a first-time submission keeps it hidden and shows the vendor a reason", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId }, []);
    await vendorListingsService.submitForReview(vendorAId, listingId);

    const result = await vendorListingsService.requestChanges(listingId, "Add more detail to the description.");
    expect(result.ok).toBe(true);

    const detail = await vendorListingsService.getDetail(vendorAId, listingId);
    expect(detail?.approvalStatus).toBe("CHANGES_REQUESTED");
    expect(detail?.changesRequestedReason).toBe("Add more detail to the description.");
    expect(detail?.listingStatus).toBe("DRAFT"); // never went public

    // Vendor can edit again now.
    const editResult = await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId, title: "Fixed title" }, []);
    expect(editResult.ok).toBe(true);
  });

  it("never lets available quantity go negative", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    const result = await vendorListingsService.updateInventory(vendorAId, listingId, {
      availableQuantity: -5,
      availabilityStatus: "IN_STOCK",
    });
    expect(result.ok).toBe(false);
  });

  it("allows inventory updates immediately, regardless of approval state", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    const result = await vendorListingsService.updateInventory(vendorAId, listingId, {
      availableQuantity: 42,
      availabilityStatus: "IN_STOCK",
    });
    expect(result.ok).toBe(true);
    const detail = await vendorListingsService.getDetail(vendorAId, listingId);
    expect(detail?.availableQuantity).toBe(42);
  });
});
