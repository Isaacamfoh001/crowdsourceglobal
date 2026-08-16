import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { messagingService } from "./service";

/** Integration tests against the real local Postgres dev database. */
describe("messagingService", () => {
  let customerAProfileId: string;
  let customerAUserId: string;
  let customerBProfileId: string;
  let customerBUserId: string;
  let vendorId: string;
  let vendorUserId: string;
  let staffUserId: string;
  let categoryId: string;
  let listingId: string;
  let draftListingId: string; // unapproved — must never become valid context

  const createdUserIds: string[] = [];
  const createdCustomerProfileIds: string[] = [];
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdListingIds: string[] = [];
  const createdConversationIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const userA = await prisma.user.create({
      data: { id: `msg-customer-a-${suffix}`, name: "Customer A", email: `msg.a.${suffix}@example.com` },
    });
    customerAUserId = userA.id;
    createdUserIds.push(userA.id);
    const customerA = await prisma.customerProfile.create({ data: { userId: userA.id, displayName: "Customer A" } });
    customerAProfileId = customerA.id;
    createdCustomerProfileIds.push(customerA.id);

    const userB = await prisma.user.create({
      data: { id: `msg-customer-b-${suffix}`, name: "Customer B", email: `msg.b.${suffix}@example.com` },
    });
    customerBUserId = userB.id;
    createdUserIds.push(userB.id);
    const customerB = await prisma.customerProfile.create({ data: { userId: userB.id, displayName: "Customer B" } });
    customerBProfileId = customerB.id;
    createdCustomerProfileIds.push(customerB.id);

    const vendorUser = await prisma.user.create({
      data: { id: `msg-vendor-user-${suffix}`, name: "Vendor Owner", email: `msg.vendor.${suffix}@example.com` },
    });
    vendorUserId = vendorUser.id;
    createdUserIds.push(vendorUser.id);

    const staff = await prisma.user.create({
      data: { id: `msg-staff-${suffix}`, name: "CSG Staff", email: `msg.staff.${suffix}@example.com` },
    });
    staffUserId = staff.id;
    createdUserIds.push(staff.id);

    const vendor = await prisma.vendor.create({
      data: {
        companyName: "Adepa Beauty Supplies",
        storefrontSlug: `msg-vendor-${suffix}`,
        verificationStatus: "APPROVED",
        contactEmail: "private-owner@example.com",
        contactPhone: "0244999999",
      },
    });
    vendorId = vendor.id;
    createdVendorIds.push(vendor.id);
    await prisma.vendorMembership.create({ data: { userId: vendorUserId, vendorId, role: "OWNER" } });

    const category = await prisma.category.create({
      data: { name: "Messaging Test Category", slug: `msg-test-category-${suffix}` },
    });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const listing = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Brazilian Human Hair 22\"",
        description: "Premium hair bundle.",
        basePrice: 480,
        moq: 1,
        availableQuantity: 20,
        approvalStatus: "APPROVED",
        listingStatus: "ACTIVE",
      },
    });
    listingId = listing.id;
    createdListingIds.push(listing.id);

    const draft = await prisma.vendorListing.create({
      data: {
        vendorId,
        categoryId,
        title: "Unreleased Product",
        description: "Not yet approved.",
        basePrice: 100,
        moq: 1,
        availableQuantity: 5,
      },
    });
    draftListingId = draft.id;
    createdListingIds.push(draft.id);
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { conversationId: { in: createdConversationIds } } });
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversationIds } } });
    await prisma.vendorListing.deleteMany({ where: { id: { in: createdListingIds } } });
    await prisma.category.deleteMany({ where: { id: { in: createdCategoryIds } } });
    await prisma.vendorMembership.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.customerProfile.deleteMany({ where: { id: { in: createdCustomerProfileIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it("creates a contextual conversation about a listing, preserving vendor + listing context", async () => {
    const result = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "LISTING",
      contextRefId: listingId,
      body: "Can you confirm 100 units are available?",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdConversationIds.push(result.value.conversationId);

    const detail = await messagingService.getForCustomer(customerAProfileId, result.value.conversationId);
    expect(detail?.contextType).toBe("LISTING");
    expect(detail?.contextLabel).toContain("Brazilian Human Hair");
    expect(detail?.contextLabel).toContain("Adepa Beauty Supplies");
    expect(detail?.messages).toHaveLength(1);
    expect(detail?.messages[0]?.body).toContain("100 units");
  });

  it("creates a contextual conversation about a vendor, preserving vendor context", async () => {
    const result = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "VENDOR",
      contextRefId: vendorId,
      body: "Do you ship outside Accra?",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdConversationIds.push(result.value.conversationId);

    const detail = await messagingService.getForCustomer(customerAProfileId, result.value.conversationId);
    expect(detail?.contextType).toBe("VENDOR");
    expect(detail?.contextLabel).toContain("Adepa Beauty Supplies");
  });

  it("reuses the open conversation for the same context instead of duplicating it", async () => {
    const first = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "LISTING",
      contextRefId: listingId,
      body: "First question.",
    });
    if (first.ok) createdConversationIds.push(first.value.conversationId);

    const second = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "LISTING",
      contextRefId: listingId,
      body: "Follow-up question.",
    });

    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.conversationId).toBe(first.value.conversationId);
    }

    const detail = first.ok ? await messagingService.getForCustomer(customerAProfileId, first.value.conversationId) : null;
    expect(detail?.messages).toHaveLength(2);
  });

  it("rejects a forged context id for an unapproved/draft listing", async () => {
    const result = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "LISTING",
      contextRefId: draftListingId,
      body: "Trying to probe a draft listing.",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a nonexistent vendor context id", async () => {
    const result = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "VENDOR",
      contextRefId: "nonexistent-vendor-id",
      body: "Should never create a conversation.",
    });
    expect(result.ok).toBe(false);
  });

  it("Customer A cannot read Customer B's conversation", async () => {
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "LISTING",
      contextRefId: listingId,
      body: "Private question from Customer A.",
    });
    if (created.ok) createdConversationIds.push(created.value.conversationId);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const asOwner = await messagingService.getForCustomer(customerAProfileId, created.value.conversationId);
    const asOther = await messagingService.getForCustomer(customerBProfileId, created.value.conversationId);
    expect(asOwner).not.toBeNull();
    expect(asOther).toBeNull();
  });

  it("Customer A cannot post into Customer B's conversation", async () => {
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "LISTING",
      contextRefId: listingId,
      body: "Customer A's conversation.",
    });
    if (created.ok) createdConversationIds.push(created.value.conversationId);
    if (!created.ok) return;

    const forgedReply = await messagingService.replyAsCustomer(
      customerBProfileId,
      customerBUserId,
      created.value.conversationId,
      "Customer B trying to post into A's conversation.",
    );
    expect(forgedReply.ok).toBe(false);

    const detail = await messagingService.getForCustomer(customerAProfileId, created.value.conversationId);
    expect(detail?.messages).toHaveLength(1); // forged reply never persisted
  });

  it("staff can see, open, and reply to a customer conversation; the customer sees the reply", async () => {
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "LISTING",
      contextRefId: listingId,
      body: "Is this in stock?",
    });
    if (created.ok) createdConversationIds.push(created.value.conversationId);
    if (!created.ok) return;

    const staffList = await messagingService.listForAdmin();
    expect(staffList.some((c) => c.id === created.value.conversationId)).toBe(true);

    const reply = await messagingService.replyAsStaff(staffUserId, created.value.conversationId, "Yes, 20 units in stock.");
    expect(reply.ok).toBe(true);

    const customerView = await messagingService.getForCustomer(customerAProfileId, created.value.conversationId);
    expect(customerView?.messages).toHaveLength(2);
    const staffMessage = customerView?.messages.find((m) => m.senderIsStaff);
    expect(staffMessage?.body).toBe("Yes, 20 units in stock.");
    expect(staffMessage?.senderName).toBe("CrownSourceGlobal");
  });

  it("orders messages deterministically by send order", async () => {
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "LISTING",
      contextRefId: listingId,
      body: "Message 1",
    });
    if (created.ok) createdConversationIds.push(created.value.conversationId);
    if (!created.ok) return;

    await messagingService.replyAsStaff(staffUserId, created.value.conversationId, "Message 2");
    await messagingService.replyAsCustomer(customerAProfileId, customerAUserId, created.value.conversationId, "Message 3");
    await messagingService.replyAsStaff(staffUserId, created.value.conversationId, "Message 4");

    const detail = await messagingService.getForCustomer(customerAProfileId, created.value.conversationId);
    expect(detail?.messages.map((m) => m.body)).toEqual(["Message 1", "Message 2", "Message 3", "Message 4"]);
  });

  it("the referenced vendor is never a participant and cannot read the customer conversation", async () => {
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "LISTING",
      contextRefId: listingId,
      body: "Asking about the vendor's product.",
    });
    if (created.ok) createdConversationIds.push(created.value.conversationId);
    if (!created.ok) return;

    // The vendor's own conversation list/detail queries never surface it —
    // structurally, participantType=CUSTOMER rows are invisible to
    // findVendorConversations/getForVendor regardless of context.
    const vendorList = await messagingService.listForVendor(vendorId);
    expect(vendorList.some((c) => c.id === created.value.conversationId)).toBe(false);

    const vendorDetail = await messagingService.getForVendor(vendorId, created.value.conversationId);
    expect(vendorDetail).toBeNull();
  });

  it("the referenced vendor cannot post into the customer conversation", async () => {
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "VENDOR",
      contextRefId: vendorId,
      body: "Question for CrownSource about this vendor.",
    });
    if (created.ok) createdConversationIds.push(created.value.conversationId);
    if (!created.ok) return;

    const forgedVendorReply = await messagingService.replyAsVendor(
      vendorId,
      vendorUserId,
      created.value.conversationId,
      "Vendor trying to reply directly to the customer.",
    );
    expect(forgedVendorReply.ok).toBe(false);

    const detail = await messagingService.getForCustomer(customerAProfileId, created.value.conversationId);
    expect(detail?.messages).toHaveLength(1);
  });

  it("never exposes the vendor's private contact fields in customer-facing conversation data", async () => {
    const created = await messagingService.startOrContinueContextual({
      customerProfileId: customerAProfileId,
      senderUserId: customerAUserId,
      contextType: "VENDOR",
      contextRefId: vendorId,
      body: "Contact leakage check.",
    });
    if (created.ok) createdConversationIds.push(created.value.conversationId);
    if (!created.ok) return;

    const detail = await messagingService.getForCustomer(customerAProfileId, created.value.conversationId);
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("private-owner@example.com");
    expect(serialized).not.toContain("0244999999");

    const summary = await messagingService.listForCustomer(customerAProfileId);
    expect(JSON.stringify(summary)).not.toContain("private-owner@example.com");
  });

  it("a vendor conversation with CrownSourceGlobal works independently of any customer conversation", async () => {
    const started = await messagingService.startVendorConversation(vendorId, vendorUserId, "How do I set up bulk pricing?");
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    createdConversationIds.push(started.value.conversationId);

    const reply = await messagingService.replyAsStaff(staffUserId, started.value.conversationId, "Here's how bulk tiers work…");
    expect(reply.ok).toBe(true);

    const vendorView = await messagingService.getForVendor(vendorId, started.value.conversationId);
    expect(vendorView?.messages).toHaveLength(2);
    expect(vendorView?.participantType).toBe("VENDOR");

    // This is not visible via any customer-facing query.
    const customerLeak = await messagingService.getForCustomer(customerAProfileId, started.value.conversationId);
    expect(customerLeak).toBeNull();
  });
});
