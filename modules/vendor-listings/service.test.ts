import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { vendorListingsService } from "./service";
import { cartService } from "../cart/service";
import * as emailProviderModule from "../../lib/email-provider";
import { processEmailQueue } from "../../lib/email-worker";

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

  // --- Regression: the manually-found "premature moderation" bug ---------
  //
  // A brand-new draft's approvalStatus defaults to PENDING (the same value
  // used for "awaiting an actual admin decision"), distinguished only by
  // submittedAt. Every one of these must hold, or a never-submitted draft
  // becomes indistinguishable from a submitted one again.

  it("a never-submitted draft does NOT appear in the admin moderation queue", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    // Deliberately do nothing else — this reproduces "vendor picks a
    // category and stops," the exact manually-found bug trigger.
    const pending = await vendorListingsService.listPendingForAdmin();
    expect(pending.some((l) => l.id === listingId)).toBe(false);
  });

  it("admin cannot approve, request changes on, or reject a never-submitted draft", async () => {
    const listingId = await createTrackedDraft(vendorAId);

    const approveResult = await vendorListingsService.approve(listingId);
    expect(approveResult.ok).toBe(false);

    const changesResult = await vendorListingsService.requestChanges(listingId, "test");
    expect(changesResult.ok).toBe(false);

    const rejectResult = await vendorListingsService.reject(listingId, "test");
    expect(rejectResult.ok).toBe(false);

    const listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(listing?.approvalStatus).toBe("PENDING");
    expect(listing?.listingStatus).toBe("DRAFT");
  });

  it("the full lifecycle stays DRAFT through category selection and content edits, only reaching PENDING on explicit submit", async () => {
    const listingId = await createTrackedDraft(vendorAId);

    let listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(listing?.listingStatus).toBe("DRAFT");
    expect(listing?.submittedAt).toBeNull();

    // Filling in full product details (title, description, price, MOQ,
    // bulk tiers) must not, by itself, change status.
    await vendorListingsService.saveContent(
      vendorAId,
      listingId,
      { ...validContent, categoryId },
      [{ minQuantity: 5, maxQuantity: null, unitPrice: 440 }],
    );
    listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(listing?.approvalStatus).toBe("PENDING");
    expect(listing?.listingStatus).toBe("DRAFT");
    expect(listing?.submittedAt).toBeNull();
    expect(listing?.basePrice.toNumber()).toBe(480);

    // Simulated "leave and resume" — re-reading and re-saving must also
    // never advance status on its own.
    const resumed = await vendorListingsService.getDetail(vendorAId, listingId);
    expect(resumed?.title).toBe(validContent.title);
    await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId }, []);
    listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(listing?.listingStatus).toBe("DRAFT");
    expect(listing?.submittedAt).toBeNull();

    // Only the explicit submit action moves it to PENDING review.
    const submitResult = await vendorListingsService.submitForReview(vendorAId, listingId);
    expect(submitResult.ok).toBe(true);
    listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(listing?.approvalStatus).toBe("PENDING");
    expect(listing?.submittedAt).not.toBeNull();

    // It now correctly appears in the moderation queue.
    const pending = await vendorListingsService.listPendingForAdmin();
    expect(pending.some((l) => l.id === listingId)).toBe(true);

    // And admin approval now correctly succeeds and activates it.
    const approveResult = await vendorListingsService.approve(listingId);
    expect(approveResult.ok).toBe(true);
    listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(listing?.approvalStatus).toBe("APPROVED");
    expect(listing?.listingStatus).toBe("ACTIVE");
  });

  // --- Regression: the manually-found zero-price bug ---------------------

  it("a listing created with an exact price is submitted, approved, and reads back with the exact same price — never zero", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    const exactPrice = 12500;

    await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId, basePrice: exactPrice }, []);
    const submitResult = await vendorListingsService.submitForReview(vendorAId, listingId);
    expect(submitResult.ok).toBe(true);

    const approveResult = await vendorListingsService.approve(listingId);
    expect(approveResult.ok).toBe(true);

    // Simulates the public catalogue read path exactly — approvalStatus +
    // listingStatus gate, basePrice read directly off the row.
    const publicRow = await prisma.vendorListing.findFirst({
      where: { id: listingId, approvalStatus: "APPROVED", listingStatus: "ACTIVE" },
    });
    expect(publicRow).not.toBeNull();
    expect(publicRow?.basePrice.toNumber()).toBe(exactPrice);
    expect(publicRow?.basePrice.toNumber()).not.toBe(0);

    const detail = await vendorListingsService.getDetail(vendorAId, listingId);
    expect(detail?.basePrice).toBe(exactPrice);
  });

  it("a vendor-created listing's exact price and bulk tiers resolve correctly through the cart — the full public integration path", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const buyer = await prisma.user.create({
      data: { id: `listing-price-buyer-${suffix}`, name: "Buyer", email: `listing.price.buyer.${suffix}@example.com` },
    });
    const customer = await prisma.customerProfile.create({ data: { userId: buyer.id, displayName: "Buyer" } });

    try {
      const listingId = await createTrackedDraft(vendorAId);
      await vendorListingsService.saveContent(
        vendorAId,
        listingId,
        { ...validContent, categoryId, basePrice: 480, moq: 1 },
        [{ minQuantity: 5, maxQuantity: null, unitPrice: 420 }],
      );
      await vendorListingsService.updateInventory(vendorAId, listingId, { availableQuantity: 50, availabilityStatus: "IN_STOCK" });
      await vendorListingsService.submitForReview(vendorAId, listingId);
      await vendorListingsService.approve(listingId);

      // Below the bulk threshold — base price applies.
      const belowTier = await cartService.addToCart(customer.id, listingId, 2);
      expect(belowTier.ok).toBe(true);
      const cartView = await cartService.getCartView(customer.id);
      const line = cartView.vendorGroups.flatMap((g) => g.lines).find((l) => l.listingId === listingId);
      expect(line?.unitPrice).toBe(480);
      expect(line?.lineTotal).toBe(960);

      // At/above the bulk threshold — tier price applies instead.
      await cartService.updateQuantity(customer.id, line!.id, 6);
      const bulkCartView = await cartService.getCartView(customer.id);
      const bulkLine = bulkCartView.vendorGroups.flatMap((g) => g.lines).find((l) => l.listingId === listingId);
      expect(bulkLine?.unitPrice).toBe(420);
      expect(bulkLine?.lineTotal).toBe(2520);
    } finally {
      await prisma.cartItem.deleteMany({ where: { cart: { customerProfileId: customer.id } } });
      await prisma.cart.deleteMany({ where: { customerProfileId: customer.id } });
      await prisma.customerProfile.delete({ where: { id: customer.id } });
      await prisma.user.delete({ where: { id: buyer.id } });
    }
  });

  it("an edit-in-flight preserves the exact proposed price through pendingChanges and merge-on-approval", async () => {
    const listingId = await createTrackedDraft(vendorAId);
    await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId, basePrice: 500 }, []);
    await vendorListingsService.submitForReview(vendorAId, listingId);
    await vendorListingsService.approve(listingId);

    const newPrice = 9999.5;
    await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId, basePrice: newPrice }, []);
    const beforeApproval = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(beforeApproval?.pendingChanges).not.toBeNull();
    expect(beforeApproval?.basePrice.toNumber()).toBe(500); // live price untouched mid-edit

    await vendorListingsService.submitForReview(vendorAId, listingId);
    const approveEditResult = await vendorListingsService.approve(listingId);
    expect(approveEditResult.ok).toBe(true);

    const afterApproval = await prisma.vendorListing.findUnique({ where: { id: listingId } });
    expect(afterApproval?.basePrice.toNumber()).toBe(newPrice);
  });

  // --- Notification dispatch ----------------------------------------------

  describe("notifications", () => {
    let ownerUserId: string;
    const createdUserIds: string[] = [];

    beforeEach(async () => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const owner = await prisma.user.create({
        data: { id: `listing-notify-owner-${suffix}`, name: "Owner", email: `listing.notify.${suffix}@example.com` },
      });
      ownerUserId = owner.id;
      createdUserIds.push(owner.id);
      await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendorAId, role: "OWNER" } });
    });

    afterAll(async () => {
      await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    });

    it("notifies and emails the vendor owner when a first-time listing is approved", async () => {
      const listingId = await createTrackedDraft(vendorAId);
      await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId }, []);
      await vendorListingsService.submitForReview(vendorAId, listingId);

      await vendorListingsService.approve(listingId);

      // Checked at the DB layer rather than via a spy on the shared
      // emailProvider singleton — every test file in this suite shares one
      // Postgres instance, so a global send-call-count assertion is
      // fragile; "was the right job enqueued for the right recipient" is not.
      const ownerEmail = (await prisma.user.findUnique({ where: { id: ownerUserId } }))!.email;
      const notification = await prisma.notification.findFirst({ where: { eventKey: { startsWith: `listing-approved:${listingId}:` } } });
      expect(notification).not.toBeNull();
      const job = await prisma.emailDeliveryJob.findFirst({ where: { notificationId: notification!.id } });
      expect(job?.to).toBe(ownerEmail);
      expect((job?.templateData as Record<string, unknown>)?.["listingTitle"]).toBe(validContent.title);
    });

    it("notifies and emails the vendor owner with the reason when changes are requested", async () => {
      const listingId = await createTrackedDraft(vendorAId);
      await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId }, []);
      await vendorListingsService.submitForReview(vendorAId, listingId);

      await vendorListingsService.requestChanges(listingId, "Add more product photos.");

      const notification = await prisma.notification.findFirst({ where: { eventKey: { startsWith: `listing-changes-requested:${listingId}:` } } });
      expect(notification).not.toBeNull();
      const job = await prisma.emailDeliveryJob.findFirst({ where: { notificationId: notification!.id } });
      expect((job?.templateData as Record<string, unknown>)?.["reason"]).toBe("Add more product photos.");
    });

    it("a failing email provider does not roll back or fail an already-successful approval", async () => {
      const listingId = await createTrackedDraft(vendorAId);
      await vendorListingsService.saveContent(vendorAId, listingId, { ...validContent, categoryId }, []);
      await vendorListingsService.submitForReview(vendorAId, listingId);

      const spy = vi.spyOn(emailProviderModule.emailProvider, "send").mockRejectedValue(new Error("simulated provider outage"));
      const approveResult = await vendorListingsService.approve(listingId);
      expect(approveResult.ok).toBe(true); // approval itself must still succeed
      await processEmailQueue();

      const listing = await prisma.vendorListing.findUnique({ where: { id: listingId } });
      expect(listing?.approvalStatus).toBe("APPROVED");
      spy.mockRestore();
    });
  });
});
