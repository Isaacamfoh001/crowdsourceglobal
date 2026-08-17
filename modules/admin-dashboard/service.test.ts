import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { adminDashboardService } from "./service";

const HOUR = 60 * 60 * 1000;
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR);

/** Integration tests against the real local Postgres dev database. */
describe("adminDashboardService", () => {
  let categoryId: string;
  let vendorId: string;
  let customerUserId: string;
  let customerProfileId: string;
  const createdIds = {
    categories: [] as string[],
    vendors: [] as string[],
    users: [] as string[],
    customerProfiles: [] as string[],
    vendorApplications: [] as string[],
    vendorListings: [] as string[],
    sourcingRequests: [] as string[],
    conversations: [] as string[],
    orders: [] as string[],
  };

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const category = await prisma.category.create({ data: { name: "Dashboard Test Category", slug: `dash-cat-${suffix}` } });
    categoryId = category.id;
    createdIds.categories.push(category.id);

    const vendor = await prisma.vendor.create({
      data: { companyName: `Dashboard Test Vendor ${suffix}`, storefrontSlug: `dash-vendor-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorId = vendor.id;
    createdIds.vendors.push(vendor.id);

    const customerUser = await prisma.user.create({
      data: { id: `dash-customer-${suffix}`, name: "Dashboard Customer", email: `dash.customer.${suffix}@example.com` },
    });
    customerUserId = customerUser.id;
    createdIds.users.push(customerUser.id);

    const customerProfile = await prisma.customerProfile.create({
      data: { userId: customerUserId, displayName: "Dashboard Customer" },
    });
    customerProfileId = customerProfile.id;
    createdIds.customerProfiles.push(customerProfile.id);
  });

  afterAll(async () => {
    await prisma.refund.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.resolutionCaseItem.deleteMany({ where: { orderItem: { orderId: { in: createdIds.orders } } } });
    await prisma.resolutionCase.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.fulfilmentIssue.deleteMany({ where: { fulfilment: { order: { id: { in: createdIds.orders } } } } });
    await prisma.fulfilment.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdIds.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: createdIds.orders } } });
    await prisma.message.deleteMany({ where: { conversationId: { in: createdIds.conversations } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdIds.conversations } } });
    await prisma.sourcingRequestActivity.deleteMany({ where: { sourcingRequestId: { in: createdIds.sourcingRequests } } });
    await prisma.customSourcingRequest.deleteMany({ where: { id: { in: createdIds.sourcingRequests } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdIds.vendorListings } } });
    await prisma.vendorApplication.deleteMany({ where: { id: { in: createdIds.vendorApplications } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdIds.customerProfiles } } });
    await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdIds.vendors } } });
    await prisma.category.deleteMany({ where: { id: { in: createdIds.categories } } });
    await prisma.$disconnect();
  });

  async function createVendorApplication(submittedAt: Date) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const applicant = await prisma.user.create({
      data: { id: `dash-applicant-${suffix}`, name: "Applicant", email: `dash.applicant.${suffix}@example.com` },
    });
    createdIds.users.push(applicant.id);
    const application = await prisma.vendorApplication.create({
      data: {
        applicantUserId: applicant.id,
        status: "SUBMITTED",
        displayName: `Test Application ${suffix}`,
        submittedAt,
      },
    });
    createdIds.vendorApplications.push(application.id);
    return application;
  }

  async function createPendingListing(submittedAt: Date) {
    const listing = await prisma.vendorListing.create({
      data: {
        title: `Dashboard Test Listing ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: "A test listing.",
        basePrice: 100,
        vendorId,
        categoryId,
        approvalStatus: "PENDING",
        listingStatus: "DRAFT",
        submittedAt,
        updatedAt: submittedAt,
      },
    });
    createdIds.vendorListings.push(listing.id);
    return listing;
  }

  async function createSourcingRequest(overrides: { assignedStaffId?: string } = {}) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const request = await prisma.customSourcingRequest.create({
      data: {
        requestNumber: `SR-TEST-${suffix}`,
        customerProfileId,
        title: "Custom embroidered tote bags",
        description: "500 units, navy canvas.",
        quantity: 500,
        deliveryCountry: "Ghana",
        status: "SUBMITTED",
        assignedStaffId: overrides.assignedStaffId,
      },
    });
    createdIds.sourcingRequests.push(request.id);
    return request;
  }

  async function createOrderWithFulfilment(fulfilmentStatus: "PREPARING" | "EXCEPTION" | "READY", updatedAt: Date, origin: "DOMESTIC_COLLECTION" | "INTERNATIONAL_INBOUND" = "DOMESTIC_COLLECTION") {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-TEST-${suffix}`,
        customerProfileId,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        subtotal: 100,
        total: 100,
        deliveryInfo: { recipientName: "Dashboard Customer", phone: "0240000000", addressLine1: "1 Test St", city: "Accra", region: "Greater Accra" },
      },
    });
    createdIds.orders.push(order.id);
    const fulfilment = await prisma.fulfilment.create({
      data: { orderId: order.id, vendorId, origin, status: fulfilmentStatus, updatedAt },
    });
    return { order, fulfilment };
  }

  // ---- Dashboard counts --------------------------------------------------

  it("counts pending vendor applications and listings awaiting review correctly", async () => {
    await createVendorApplication(hoursAgo(1));
    await createPendingListing(hoursAgo(1));

    const data = await adminDashboardService.getDashboardData("SUPER_ADMIN");
    expect(data.summary.pendingVendorApplications).toBeGreaterThanOrEqual(1);
    expect(data.summary.listingsAwaitingReview).toBeGreaterThanOrEqual(1);
  });

  it("counts delivery issues and ready-for-collection fulfilments correctly for an operational role", async () => {
    const { fulfilment } = await createOrderWithFulfilment("EXCEPTION", new Date());
    await prisma.fulfilmentIssue.create({
      data: { fulfilmentId: fulfilment.id, reportedByUserId: customerUserId, category: "damaged", status: "OPEN", description: "Item arrived damaged." },
    });
    await createOrderWithFulfilment("READY", new Date());

    const data = await adminDashboardService.getDashboardData("OPS_ADMIN");
    expect(data.summary.deliveryIssues).toBeGreaterThanOrEqual(1);
    expect(data.summary.readyForCollection).toBeGreaterThanOrEqual(1);
  });

  it("counts active sourcing requests correctly", async () => {
    await createSourcingRequest();
    const data = await adminDashboardService.getDashboardData("SUPER_ADMIN");
    expect(data.summary.activeSourcingRequests).toBeGreaterThanOrEqual(1);
  });

  // ---- Attention items: appearance / ageing / disappearance --------------

  it("a stale vendor application appears in the attention queue; a fresh one does not", async () => {
    const stale = await createVendorApplication(hoursAgo(30)); // past the 24h default warning
    const fresh = await createVendorApplication(hoursAgo(1));

    const data = await adminDashboardService.getDashboardData("SUPER_ADMIN");
    const staleItem = data.attentionItems.find((i) => i.type === "VENDOR_APPLICATION_PENDING" && i.targetUrl === `/admin/vendor-applications/${stale.id}`);
    const freshItem = data.attentionItems.find((i) => i.type === "VENDOR_APPLICATION_PENDING" && i.targetUrl === `/admin/vendor-applications/${fresh.id}`);
    expect(staleItem).toBeTruthy();
    expect(staleItem?.severity).not.toBe("NORMAL");
    expect(freshItem).toBeUndefined(); // NORMAL-severity items are not surfaced as attention rows
  });

  it("a stale listing review appears in the attention queue, and disappears once approved", async () => {
    const listing = await createPendingListing(hoursAgo(60)); // past the 48h default warning

    const before = await adminDashboardService.getDashboardData("SUPER_ADMIN");
    expect(before.attentionItems.some((i) => i.type === "LISTING_MODERATION_PENDING" && i.targetUrl === `/admin/listings/${listing.id}`)).toBe(true);

    await prisma.vendorListing.update({ where: { id: listing.id }, data: { approvalStatus: "APPROVED", listingStatus: "ACTIVE" } });

    const after = await adminDashboardService.getDashboardData("SUPER_ADMIN");
    expect(after.attentionItems.some((i) => i.targetUrl === `/admin/listings/${listing.id}`)).toBe(false);
  });

  it("an unresolved fulfilment exception is always CRITICAL regardless of age, and disappears once resolved", async () => {
    const { fulfilment } = await createOrderWithFulfilment("EXCEPTION", new Date());
    const issue = await prisma.fulfilmentIssue.create({
      data: { fulfilmentId: fulfilment.id, reportedByUserId: customerUserId, category: "damaged", status: "OPEN", description: "Item arrived damaged." },
    });

    const before = await adminDashboardService.getDashboardData("OPS_ADMIN");
    const item = before.attentionItems.find((i) => i.type === "DELIVERY_ISSUE" && i.targetUrl === `/admin/operations/${fulfilment.id}`);
    expect(item?.severity).toBe("CRITICAL");

    await prisma.fulfilmentIssue.update({ where: { id: issue.id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    await prisma.fulfilment.update({ where: { id: fulfilment.id }, data: { status: "PREPARING", updatedAt: new Date() } });

    const after = await adminDashboardService.getDashboardData("OPS_ADMIN");
    expect(after.attentionItems.some((i) => i.type === "DELIVERY_ISSUE" && i.targetUrl === `/admin/operations/${fulfilment.id}`)).toBe(false);
  });

  it("a fulfilment stuck PREPARING past the warning threshold appears as overdue", async () => {
    const { fulfilment } = await createOrderWithFulfilment("PREPARING", hoursAgo(60)); // past the 48h default, no vendor lead time set
    const data = await adminDashboardService.getDashboardData("OPS_ADMIN");
    expect(data.attentionItems.some((i) => i.type === "FULFILMENT_OVERDUE" && i.targetUrl === `/admin/operations/${fulfilment.id}`)).toBe(true);
  });

  it("an unassigned sourcing request appears as unassigned, and resolves once assigned", async () => {
    const request = await createSourcingRequest();
    const before = await adminDashboardService.getDashboardData("OPS_ADMIN");
    expect(before.attentionItems.some((i) => i.type === "SOURCING_UNASSIGNED" && i.targetUrl === `/admin/sourcing/${request.id}`)).toBe(true);

    const staffUser = await prisma.user.create({ data: { id: `dash-staff-${Date.now()}`, name: "Staff", email: `dash.staff.${Date.now()}@example.com` } });
    createdIds.users.push(staffUser.id);
    const staff = await prisma.adminUser.create({ data: { userId: staffUser.id, role: "OPS_ADMIN" } });

    await prisma.customSourcingRequest.update({ where: { id: request.id }, data: { assignedStaffId: staff.id } });

    const after = await adminDashboardService.getDashboardData("OPS_ADMIN");
    expect(after.attentionItems.some((i) => i.type === "SOURCING_UNASSIGNED" && i.targetUrl === `/admin/sourcing/${request.id}`)).toBe(false);

    await prisma.adminUser.delete({ where: { id: staff.id } });
  });

  it("an unanswered customer message appears in the attention queue, and disappears once staff reply", async () => {
    const conversation = await prisma.conversation.create({
      data: {
        participantType: "CUSTOMER",
        contextType: "GENERAL",
        customerProfileId,
        messages: { create: { senderUserId: customerUserId, body: "Where is my order?", senderIsStaff: false, createdAt: hoursAgo(6) } },
      },
    });
    createdIds.conversations.push(conversation.id);
    await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: hoursAgo(6) } });

    const before = await adminDashboardService.getDashboardData("OPS_ADMIN");
    expect(before.attentionItems.some((i) => i.type === "MESSAGE_UNANSWERED" && i.targetUrl === `/admin/messages/${conversation.id}`)).toBe(true);

    await prisma.message.create({ data: { conversationId: conversation.id, senderUserId: customerUserId, body: "Reply from staff", senderIsStaff: true } });

    const after = await adminDashboardService.getDashboardData("OPS_ADMIN");
    expect(after.attentionItems.some((i) => i.targetUrl === `/admin/messages/${conversation.id}`)).toBe(false);
  });

  // ---- Role access --------------------------------------------------------

  it("FINANCE_ADMIN does not see operational (messages/operations/sourcing-ops) attention items or counts", async () => {
    const { fulfilment } = await createOrderWithFulfilment("EXCEPTION", new Date());
    await prisma.fulfilmentIssue.create({
      data: { fulfilmentId: fulfilment.id, reportedByUserId: customerUserId, category: "damaged", status: "OPEN", description: "Damaged." },
    });

    const data = await adminDashboardService.getDashboardData("FINANCE_ADMIN");
    expect(data.attentionItems.some((i) => i.type === "DELIVERY_ISSUE")).toBe(false);
    expect(data.summary.deliveryIssues).toBe(0);
    expect(data.summary.readyForCollection).toBe(0);
    expect(data.summary.unansweredConversations).toBe(0);
  });

  it("OPS_ADMIN and SUPER_ADMIN both see operational attention items", async () => {
    const { fulfilment } = await createOrderWithFulfilment("EXCEPTION", new Date());
    await prisma.fulfilmentIssue.create({
      data: { fulfilmentId: fulfilment.id, reportedByUserId: customerUserId, category: "damaged", status: "OPEN", description: "Damaged." },
    });

    const opsData = await adminDashboardService.getDashboardData("OPS_ADMIN");
    const superData = await adminDashboardService.getDashboardData("SUPER_ADMIN");
    expect(opsData.attentionItems.some((i) => i.type === "DELIVERY_ISSUE" && i.targetUrl === `/admin/operations/${fulfilment.id}`)).toBe(true);
    expect(superData.attentionItems.some((i) => i.type === "DELIVERY_ISSUE" && i.targetUrl === `/admin/operations/${fulfilment.id}`)).toBe(true);
  });

  // ---- Search ---------------------------------------------------------------

  it("search finds a vendor by name for an operational role, but not for FINANCE_ADMIN", async () => {
    const opsResults = await adminDashboardService.search(vendorId.length > 0 ? (await prisma.vendor.findUnique({ where: { id: vendorId } }))!.companyName.slice(0, 15) : "", "OPS_ADMIN");
    expect(opsResults.some((r) => r.type === "VENDOR")).toBe(true);

    const financeResults = await adminDashboardService.search((await prisma.vendor.findUnique({ where: { id: vendorId } }))!.companyName.slice(0, 15), "FINANCE_ADMIN");
    expect(financeResults.some((r) => r.type === "VENDOR")).toBe(false);
  });

  it("search finds a sourcing request by request number", async () => {
    const request = await createSourcingRequest();
    const results = await adminDashboardService.search(request.requestNumber, "SUPER_ADMIN");
    expect(results.some((r) => r.type === "SOURCING_REQUEST" && r.targetUrl === `/admin/sourcing/${request.id}`)).toBe(true);
  });

  it("search finds a listing by title", async () => {
    const listing = await createPendingListing(new Date());
    const results = await adminDashboardService.search(listing.title, "SUPER_ADMIN");
    expect(results.some((r) => r.type === "LISTING" && r.targetUrl === `/admin/listings/${listing.id}`)).toBe(true);
  });

  it("returns no results for a query shorter than 2 characters", async () => {
    const results = await adminDashboardService.search("a", "SUPER_ADMIN");
    expect(results).toEqual([]);
  });

  // ---- Pagination -----------------------------------------------------------

  it("getAttentionQueue paginates with a bounded page size", async () => {
    for (let i = 0; i < 3; i += 1) {
      await createVendorApplication(hoursAgo(30 + i));
    }
    const page1 = await adminDashboardService.getAttentionQueue("SUPER_ADMIN", {}, 1);
    expect(page1.items.length).toBeLessThanOrEqual(page1.pageSize);
    expect(page1.total).toBeGreaterThanOrEqual(3);
  });

  it("getAttentionQueue filters by type", async () => {
    await createVendorApplication(hoursAgo(30));
    const result = await adminDashboardService.getAttentionQueue("SUPER_ADMIN", { type: "VENDOR_APPLICATION_PENDING" }, 1);
    expect(result.items.every((i) => i.type === "VENDOR_APPLICATION_PENDING")).toBe(true);
  });

  // ---- M9 resolution attention integration -----------------------------------

  it("an unassigned resolution case appears as RESOLUTION_UNASSIGNED for an operational role, and not for FINANCE_ADMIN", async () => {
    const { order } = await createOrderWithFulfilment("PREPARING", new Date());
    const resolutionCase = await prisma.resolutionCase.create({
      data: {
        caseNumber: `RES-TEST-${Date.now()}`,
        customerProfileId,
        orderId: order.id,
        issueType: "ITEM_DAMAGED",
        customerDescription: "Test case.",
        status: "UNDER_REVIEW",
        updatedAt: hoursAgo(20), // past the 12h default unassigned threshold
      },
    });

    const opsData = await adminDashboardService.getDashboardData("OPS_ADMIN");
    expect(opsData.attentionItems.some((i) => i.type === "RESOLUTION_UNASSIGNED" && i.targetUrl === `/admin/resolutions/${resolutionCase.id}`)).toBe(true);
    expect(opsData.summary.openResolutionCases).toBeGreaterThanOrEqual(1);

    const financeData = await adminDashboardService.getDashboardData("FINANCE_ADMIN");
    expect(financeData.attentionItems.some((i) => i.type === "RESOLUTION_UNASSIGNED")).toBe(false);
    expect(financeData.summary.openResolutionCases).toBe(0);
  });

  it("a failed refund always appears as CRITICAL, and search finds the case by number", async () => {
    const { order } = await createOrderWithFulfilment("PREPARING", new Date());
    const resolutionCase = await prisma.resolutionCase.create({
      data: {
        caseNumber: `RES-TEST-${Date.now()}-B`,
        customerProfileId,
        orderId: order.id,
        issueType: "ITEM_DAMAGED",
        customerDescription: "Test case.",
        status: "RESOLUTION_APPROVED",
      },
    });
    await prisma.refund.create({
      data: { resolutionCaseId: resolutionCase.id, orderId: order.id, itemsAmount: 50, amount: 50, status: "FAILED" },
    });

    const data = await adminDashboardService.getDashboardData("OPS_ADMIN");
    const item = data.attentionItems.find((i) => i.type === "REFUND_FAILED" && i.targetUrl === `/admin/resolutions/${resolutionCase.id}`);
    expect(item?.severity).toBe("CRITICAL");

    const results = await adminDashboardService.search(resolutionCase.caseNumber, "OPS_ADMIN");
    expect(results.some((r) => r.type === "RESOLUTION_CASE" && r.targetUrl === `/admin/resolutions/${resolutionCase.id}`)).toBe(true);
  });
});
