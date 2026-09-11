import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { manufacturerApplicationsService } from "./service";

/** Integration tests against the real local Postgres dev database — same convention as modules/beauty-professionals/service.test.ts. */
describe("manufacturerApplicationsService", () => {
  let sellerVendorId: string;
  let ownerUserId: string;
  let adminUserId: string;
  let categorySlug: string;
  const createdVendorIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendor = await prisma.vendor.create({
      data: {
        companyName: "M32.8 Distributor Co",
        storefrontSlug: `m32-8-vendor-${suffix}`,
        verificationStatus: "APPROVED",
        sellerType: "DISTRIBUTOR_WHOLESALER",
        country: "Ghana",
      },
    });
    sellerVendorId = vendor.id;
    createdVendorIds.push(vendor.id);

    const owner = await prisma.user.create({
      data: { id: `m32-8-owner-${suffix}`, name: "Owner", email: `m32.8.owner.${suffix}@example.com` },
    });
    ownerUserId = owner.id;
    createdUserIds.push(owner.id);
    await prisma.vendorMembership.create({ data: { userId: owner.id, vendorId: vendor.id, role: "OWNER" } });

    const admin = await prisma.user.create({
      data: { id: `m32-8-admin-${suffix}`, name: "Admin", email: `m32.8.admin.${suffix}@example.com` },
    });
    adminUserId = admin.id;
    createdUserIds.push(admin.id);

    const category = await prisma.category.upsert({
      where: { slug: "m32-8-test-category" },
      create: { name: "M32.8 Test Category", slug: "m32-8-test-category" },
      update: {},
    });
    categorySlug = category.slug;
    createdCategoryIds.push(category.id);
  });

  afterAll(async () => {
    await prisma.manufacturerApplication.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendorMembership.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it("has no application until the vendor applies", async () => {
    const application = await manufacturerApplicationsService.getForVendor(sellerVendorId);
    expect(application).toBeNull();
  });

  it("creates and immediately submits on first submitOrUpdate — no separate draft step", async () => {
    const result = await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("SUBMITTED");

    const application = await manufacturerApplicationsService.getForVendor(sellerVendorId);
    expect(application?.status).toBe("SUBMITTED");
    expect(application?.submittedAt).not.toBeNull();
  });

  it("rejects submission with neither a real category nor 'Other' text", async () => {
    const result = await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [] });
    expect(result.ok).toBe(false);
  });

  it("categoryOther rule: an ordinary category selection always clears categoryOther", async () => {
    const result = await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, {
      categorySlugs: [categorySlug],
      categoryOther: "should be ignored",
    });
    expect(result.ok).toBe(true);

    const application = await manufacturerApplicationsService.getForVendor(sellerVendorId);
    expect(application?.categorySlugs).toEqual([categorySlug]);
    expect(application?.categoryOther).toBeNull();
  });

  it("categoryOther rule: 'Other / Not listed' (no real category) requires a non-empty, trimmed description", async () => {
    const empty = await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [], categoryOther: "   " });
    expect(empty.ok).toBe(false);

    const result = await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, {
      categorySlugs: [],
      categoryOther: "  Custom-fabricated steel drums  ",
    });
    expect(result.ok).toBe(true);

    const application = await manufacturerApplicationsService.getForVendor(sellerVendorId);
    expect(application?.categorySlugs).toEqual([]);
    expect(application?.categoryOther).toBe("Custom-fabricated steel drums");
  });

  it("cannot resubmit while already awaiting review", async () => {
    await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    const result = await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    expect(result.ok).toBe(false);
  });

  it("approve() sets status APPROVED and leaves Vendor.sellerType completely untouched", async () => {
    await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    const application = await manufacturerApplicationsService.getForVendor(sellerVendorId);

    const result = await manufacturerApplicationsService.approve(adminUserId, application!.id);
    expect(result.ok).toBe(true);

    const updated = await manufacturerApplicationsService.getForVendor(sellerVendorId);
    expect(updated?.status).toBe("APPROVED");

    // The whole point of M32.8's design: sellerType is never overwritten.
    const vendor = await prisma.vendor.findUnique({ where: { id: sellerVendorId } });
    expect(vendor?.sellerType).toBe("DISTRIBUTOR_WHOLESALER");
  });

  it("a member of the applying Vendor cannot approve/reject/request-changes their own vendor's application", async () => {
    await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    const application = await manufacturerApplicationsService.getForVendor(sellerVendorId);

    const approveResult = await manufacturerApplicationsService.approve(ownerUserId, application!.id);
    expect(approveResult.ok).toBe(false);
  });

  it("requestChanges sets CHANGES_REQUESTED with a reason, then allows resubmission", async () => {
    await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    const application = await manufacturerApplicationsService.getForVendor(sellerVendorId);

    const result = await manufacturerApplicationsService.requestChanges(adminUserId, application!.id, "Add more detail.");
    expect(result.ok).toBe(true);

    const updated = await manufacturerApplicationsService.getForVendor(sellerVendorId);
    expect(updated?.status).toBe("CHANGES_REQUESTED");
    expect(updated?.decisionReason).toBe("Add more detail.");

    const resubmit = await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    expect(resubmit.ok).toBe(true);
    const resubmitted = await manufacturerApplicationsService.getForVendor(sellerVendorId);
    expect(resubmitted?.status).toBe("SUBMITTED");
    expect(resubmitted?.decisionReason).toBeNull();
  });

  it("reject sets REJECTED with a visible reason", async () => {
    await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    const application = await manufacturerApplicationsService.getForVendor(sellerVendorId);

    const result = await manufacturerApplicationsService.reject(adminUserId, application!.id, "Not eligible.");
    expect(result.ok).toBe(true);

    const updated = await manufacturerApplicationsService.getForVendor(sellerVendorId);
    expect(updated?.status).toBe("REJECTED");
    expect(updated?.decisionReason).toBe("Not eligible.");
  });

  it("cannot edit an already-APPROVED application", async () => {
    await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    const application = await manufacturerApplicationsService.getForVendor(sellerVendorId);
    await manufacturerApplicationsService.approve(adminUserId, application!.id);

    const result = await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    expect(result.ok).toBe(false);
  });

  it("listForAdminPaginated surfaces the Vendor's existing sellerType alongside the request", async () => {
    await manufacturerApplicationsService.submitOrUpdate(sellerVendorId, { categorySlugs: [categorySlug] });
    const { rows } = await manufacturerApplicationsService.listForAdminPaginated();
    const row = rows.find((r) => r.vendorId === sellerVendorId);
    expect(row).toBeDefined();
    expect(row?.vendorSellerType).toBe("DISTRIBUTOR_WHOLESALER");
  });
});
