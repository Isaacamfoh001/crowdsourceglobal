import { prisma } from "../../lib/db";
import { messagingRepository } from "./repository";
import { onMessagePersisted } from "./events";
import { catalogueRepository } from "../catalogue/repository";
import { vendorsRepository } from "../vendors/repository";
import { administrationRepository } from "../administration/repository";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { ok, err, type Result } from "../../lib/result";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import type { ConversationDetail, ConversationSummary, MessageView, AdminConversationSummary } from "./types";

type RawConversation = Awaited<ReturnType<typeof messagingRepository.findAllForAdmin>>["rows"][number];

/**
 * Staff-attention notification for an inbound customer/vendor message —
 * every send is a genuinely new event (message.id is naturally unique), so
 * the eventKey needs no extra timestamp component. Broadcasts to every
 * admin (same pattern as new-vendor-application/new-sourcing-request) —
 * there is no per-conversation assignment concept for messaging in M7, see
 * docs/domain/entities.md.
 */
async function notifyStaffOfNewMessage(conversationId: string, messageId: string, counterpartyName: string): Promise<void> {
  const admins = await administrationRepository.listAllForNotification();
  for (const admin of admins) {
    await notificationsService.notify({
      recipientUserId: admin.userId,
      type: "ADMIN_NEW_MESSAGE",
      title: "New message needs a reply",
      body: `${counterpartyName} sent a new message.`,
      targetUrl: notificationLinks.adminMessage(conversationId),
      eventKey: `admin-new-message:${messageId}:${admin.userId}`,
      email: {
        to: admin.user.email,
        subject: "New message needs a reply",
        templateKey: "admin-new-message",
        templateData: { counterpartyName, conversationId },
      },
    });
  }
}

function contextLabel(row: RawConversation): string {
  if (row.contextListing) {
    return `About: ${row.contextListing.title} (${row.contextListing.vendor.companyName})`;
  }
  if (row.contextVendor) {
    return `About: ${row.contextVendor.companyName}`;
  }
  if (row.contextOrder) {
    return `About order ${row.contextOrder.orderNumber}`;
  }
  if (row.contextSourcingRequest) {
    return `About sourcing request ${row.contextSourcingRequest.requestNumber}`;
  }
  if (row.contextResolutionCase) {
    return `About case ${row.contextResolutionCase.caseNumber}`;
  }
  return "General";
}

function toMessageView(row: RawConversation["messages"][number]): MessageView {
  return {
    id: row.id,
    body: row.body,
    senderIsStaff: row.senderIsStaff,
    senderName: row.senderIsStaff ? "CrownSourceGlobal" : row.senderUser.name,
    createdAt: row.createdAt,
  };
}

function toSummary(row: RawConversation): ConversationSummary {
  const lastMessage = row.messages.at(-1);
  return {
    id: row.id,
    participantType: row.participantType,
    contextType: row.contextType,
    status: row.status,
    contextLabel: contextLabel(row),
    lastMessage: lastMessage ? lastMessage.body : null,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

function toDetail(row: RawConversation): ConversationDetail {
  return { ...toSummary(row), messages: row.messages.map(toMessageView) };
}

function toAdminSummary(row: RawConversation): AdminConversationSummary {
  const counterpartyName =
    row.participantType === "CUSTOMER"
      ? (row.customerProfile?.displayName ?? row.customerProfile?.user.name ?? "Customer")
      : (row.vendor?.companyName ?? "Vendor");
  return { ...toSummary(row), counterpartyName };
}

export const messagingService = {
  // --- Customer --------------------------------------------------------

  async listForCustomer(customerProfileId: string, page = 1): Promise<{ rows: ConversationSummary[]; total: number; pageSize: number }> {
    const { rows, total } = await messagingRepository.findCustomerConversations(customerProfileId, page, DEFAULT_PAGE_SIZE);
    return { rows: rows.map(toSummary), total, pageSize: DEFAULT_PAGE_SIZE };
  },

  async getForCustomer(customerProfileId: string, conversationId: string): Promise<ConversationDetail | null> {
    const row = await messagingRepository.findCustomerConversationById(customerProfileId, conversationId);
    return row ? toDetail(row) : null;
  },

  /**
   * "Ask about this item" / "Ask about this vendor" / "Get help with this
   * delivery" — reuses an existing open thread for the same context instead
   * of spawning a duplicate one every time the customer clicks the CTA
   * again.
   *
   * `contextRefId` is client-submitted, so it is never trusted as-is: for
   * LISTING/VENDOR it must resolve to something publicly visible (approved);
   * for ORDER it must resolve to an Order actually owned by this customer.
   * Without this, a forged id could attach an unapproved listing's private
   * details, or worse, another customer's Order, to a conversation record
   * (CLAUDE.md's IDOR/context-forgery concern).
   */
  async startOrContinueContextual(input: {
    customerProfileId: string;
    senderUserId: string;
    contextType: "LISTING" | "VENDOR" | "ORDER" | "SOURCING_REQUEST" | "RESOLUTION_CASE";
    contextRefId: string;
    body: string;
  }): Promise<Result<{ conversationId: string }>> {
    if (input.body.trim().length === 0) return err("Write a message before sending.");

    if (input.contextType === "LISTING") {
      const listing = await catalogueRepository.getListingById(input.contextRefId);
      if (!listing) return err("This listing is no longer available.");
    } else if (input.contextType === "VENDOR") {
      const vendor = await vendorsRepository.findPublicVendorById(input.contextRefId);
      if (!vendor) return err("This vendor is no longer available.");
    } else if (input.contextType === "ORDER") {
      const order = await prisma.order.findFirst({
        where: { id: input.contextRefId, customerProfileId: input.customerProfileId },
        select: { id: true },
      });
      if (!order) return err("Order not found.");
    } else if (input.contextType === "SOURCING_REQUEST") {
      const request = await prisma.customSourcingRequest.findFirst({
        where: { id: input.contextRefId, customerProfileId: input.customerProfileId },
        select: { id: true },
      });
      if (!request) return err("Sourcing request not found.");
    } else if (input.contextType === "RESOLUTION_CASE") {
      const resolutionCase = await prisma.resolutionCase.findFirst({
        where: { id: input.contextRefId, customerProfileId: input.customerProfileId },
        select: { id: true },
      });
      if (!resolutionCase) return err("Case not found.");
    } else {
      return err("Invalid conversation context.");
    }

    const existing = await messagingRepository.findOpenCustomerConversationByContext(
      input.customerProfileId,
      input.contextType,
      input.contextRefId,
    );
    if (existing) {
      const message = await messagingRepository.addMessage(existing.id, input.senderUserId, input.body, false);
      onMessagePersisted({ id: message.id, conversationId: existing.id, senderIsStaff: false });
      const counterpartyName = existing.customerProfile?.displayName ?? existing.customerProfile?.user.name ?? "A customer";
      void notifyStaffOfNewMessage(existing.id, message.id, counterpartyName);
      return ok({ conversationId: existing.id });
    }

    const created = await messagingRepository.createCustomerConversation({
      customerProfileId: input.customerProfileId,
      contextType: input.contextType,
      contextListingId: input.contextType === "LISTING" ? input.contextRefId : undefined,
      contextVendorId: input.contextType === "VENDOR" ? input.contextRefId : undefined,
      contextOrderId: input.contextType === "ORDER" ? input.contextRefId : undefined,
      contextSourcingRequestId: input.contextType === "SOURCING_REQUEST" ? input.contextRefId : undefined,
      contextResolutionCaseId: input.contextType === "RESOLUTION_CASE" ? input.contextRefId : undefined,
      senderUserId: input.senderUserId,
      body: input.body,
    });
    const firstMessage = created.messages.at(-1);
    if (firstMessage) {
      onMessagePersisted({ id: firstMessage.id, conversationId: created.id, senderIsStaff: false });
      const counterpartyName = created.customerProfile?.displayName ?? created.customerProfile?.user.name ?? "A customer";
      void notifyStaffOfNewMessage(created.id, firstMessage.id, counterpartyName);
    }
    return ok({ conversationId: created.id });
  },

  async replyAsCustomer(
    customerProfileId: string,
    senderUserId: string,
    conversationId: string,
    body: string,
  ): Promise<Result<null>> {
    if (body.trim().length === 0) return err("Write a message before sending.");
    const conversation = await messagingRepository.findCustomerConversationById(customerProfileId, conversationId);
    if (!conversation) return err("Conversation not found.");
    const message = await messagingRepository.addMessage(conversationId, senderUserId, body, false);
    onMessagePersisted({ id: message.id, conversationId, senderIsStaff: false });
    const counterpartyName = conversation.customerProfile?.displayName ?? conversation.customerProfile?.user.name ?? "A customer";
    void notifyStaffOfNewMessage(conversationId, message.id, counterpartyName);
    return ok(null);
  },

  // --- Vendor ------------------------------------------------------------

  async listForVendor(vendorId: string, page = 1): Promise<{ rows: ConversationSummary[]; total: number; pageSize: number }> {
    const { rows, total } = await messagingRepository.findVendorConversations(vendorId, page, DEFAULT_PAGE_SIZE);
    return { rows: rows.map(toSummary), total, pageSize: DEFAULT_PAGE_SIZE };
  },

  async getForVendor(vendorId: string, conversationId: string): Promise<ConversationDetail | null> {
    const row = await messagingRepository.findVendorConversationById(vendorId, conversationId);
    return row ? toDetail(row) : null;
  },

  async startVendorConversation(vendorId: string, senderUserId: string, body: string): Promise<Result<{ conversationId: string }>> {
    if (body.trim().length === 0) return err("Write a message before sending.");
    const created = await messagingRepository.createVendorConversation({ vendorId, senderUserId, body });
    const firstMessage = created.messages.at(-1);
    if (firstMessage) {
      onMessagePersisted({ id: firstMessage.id, conversationId: created.id, senderIsStaff: false });
      void notifyStaffOfNewMessage(created.id, firstMessage.id, created.vendor?.companyName ?? "A vendor");
    }
    return ok({ conversationId: created.id });
  },

  /**
   * Vendor-initiated equivalent of startOrContinueContextual (M9) — a Vendor proactively messaging CrownSource about a resolution case, before staff has necessarily asked anything.
   *
   * `contextResolutionCaseId` is client-submitted (M30 exposes this over
   * `/api/v1/vendor/messages`), so — same reasoning as every context check
   * in `startOrContinueContextual` above — it is never trusted as-is: it
   * must resolve to a case that actually involves this vendor's own
   * fulfilment items, via the same ownership check
   * `resolutionsService.getForVendor` already enforces for the read side.
   * Without this, a vendor could tag a conversation with an arbitrary
   * (possibly another vendor's) case id.
   */
  async startOrContinueVendorContextual(input: {
    vendorId: string;
    senderUserId: string;
    contextResolutionCaseId: string;
    body: string;
  }): Promise<Result<{ conversationId: string }>> {
    if (input.body.trim().length === 0) return err("Write a message before sending.");

    const { resolutionsService } = await import("../resolutions/service");
    const resolutionCase = await resolutionsService.getForVendor(input.vendorId, input.contextResolutionCaseId);
    if (!resolutionCase) return err("Case not found.");

    const existing = await messagingRepository.findOpenVendorConversationByContext(input.vendorId, input.contextResolutionCaseId);
    if (existing) {
      const message = await messagingRepository.addMessage(existing.id, input.senderUserId, input.body, false);
      onMessagePersisted({ id: message.id, conversationId: existing.id, senderIsStaff: false });
      void notifyStaffOfNewMessage(existing.id, message.id, existing.vendor?.companyName ?? "A vendor");
      return ok({ conversationId: existing.id });
    }

    const created = await messagingRepository.createVendorConversation({
      vendorId: input.vendorId,
      contextResolutionCaseId: input.contextResolutionCaseId,
      senderUserId: input.senderUserId,
      body: input.body,
    });
    const firstMessage = created.messages.at(-1);
    if (firstMessage) {
      onMessagePersisted({ id: firstMessage.id, conversationId: created.id, senderIsStaff: false });
      void notifyStaffOfNewMessage(created.id, firstMessage.id, created.vendor?.companyName ?? "A vendor");
    }
    return ok({ conversationId: created.id });
  },

  async replyAsVendor(
    vendorId: string,
    senderUserId: string,
    conversationId: string,
    body: string,
  ): Promise<Result<null>> {
    if (body.trim().length === 0) return err("Write a message before sending.");
    const conversation = await messagingRepository.findVendorConversationById(vendorId, conversationId);
    if (!conversation) return err("Conversation not found.");
    const message = await messagingRepository.addMessage(conversationId, senderUserId, body, false);
    onMessagePersisted({ id: message.id, conversationId, senderIsStaff: false });
    void notifyStaffOfNewMessage(conversationId, message.id, conversation.vendor?.companyName ?? "A vendor");
    return ok(null);
  },

  // --- Admin/staff -------------------------------------------------------

  async listForAdmin(status?: "OPEN" | "CLOSED", page = 1): Promise<{ rows: AdminConversationSummary[]; total: number; pageSize: number }> {
    const { rows, total } = await messagingRepository.findAllForAdmin(status, page, DEFAULT_PAGE_SIZE);
    return { rows: rows.map(toAdminSummary), total, pageSize: DEFAULT_PAGE_SIZE };
  },

  async getForAdmin(conversationId: string): Promise<ConversationDetail | null> {
    const row = await messagingRepository.findByIdForAdmin(conversationId);
    return row ? toDetail(row) : null;
  },

  async replyAsStaff(staffUserId: string, conversationId: string, body: string): Promise<Result<null>> {
    if (body.trim().length === 0) return err("Write a message before sending.");
    const conversation = await messagingRepository.findByIdForAdmin(conversationId);
    if (!conversation) return err("Conversation not found.");
    const message = await messagingRepository.addMessage(conversationId, staffUserId, body, true);
    onMessagePersisted({ id: message.id, conversationId, senderIsStaff: true });

    if (conversation.participantType === "CUSTOMER" && conversation.customerProfile) {
      await notificationsService.notify({
        recipientUserId: conversation.customerProfile.userId,
        type: "STAFF_REPLY",
        title: "CrownSourceGlobal replied to your message",
        body: "You have a new reply from CrownSourceGlobal.",
        targetUrl: notificationLinks.customerMessage(conversationId),
        eventKey: `staff-reply:${message.id}`,
        email: {
          to: conversation.customerProfile.user.email,
          subject: "CrownSourceGlobal replied to your message",
          templateKey: "staff-reply",
          templateData: { conversationId },
        },
      });
    } else if (conversation.participantType === "VENDOR" && conversation.vendor) {
      const owner = await vendorsRepository.findOwnerUserIdAndEmail(conversation.vendor.id);
      if (owner) {
        await notificationsService.notify({
          recipientUserId: owner.userId,
          type: "VENDOR_STAFF_REPLY",
          title: "CrownSourceGlobal replied to your message",
          body: "You have a new reply from CrownSourceGlobal.",
          targetUrl: notificationLinks.vendorMessage(conversationId),
          eventKey: `vendor-staff-reply:${message.id}`,
          email: {
            to: owner.email,
            subject: "CrownSourceGlobal replied to your message",
            templateKey: "vendor-staff-reply",
            templateData: { conversationId },
          },
        });
      }
    }

    return ok(null);
  },

  /**
   * Staff-initiated variant of startOrContinueContextual (M6's "request
   * clarification" workflow) — CrownSource may need to message a customer
   * about a sourcing request before that customer has ever sent a message
   * themselves, unlike every other contextual conversation in this app
   * which is always customer-initiated. Reuses the same
   * find-open-conversation-by-context dedup as the customer-side path, so
   * a request never ends up with two open threads regardless of who spoke
   * first.
   */
  async staffStartOrContinueContextual(input: {
    customerProfileId: string;
    staffUserId: string;
    contextType: "SOURCING_REQUEST" | "RESOLUTION_CASE";
    contextRefId: string;
    body: string;
  }): Promise<Result<{ conversationId: string }>> {
    if (input.body.trim().length === 0) return err("Write a message before sending.");

    const existing = await messagingRepository.findOpenCustomerConversationByContext(
      input.customerProfileId,
      input.contextType,
      input.contextRefId,
    );
    if (existing) {
      const message = await messagingRepository.addMessage(existing.id, input.staffUserId, input.body, true);
      onMessagePersisted({ id: message.id, conversationId: existing.id, senderIsStaff: true });
      return ok({ conversationId: existing.id });
    }

    const created = await messagingRepository.createCustomerConversation({
      customerProfileId: input.customerProfileId,
      contextType: input.contextType,
      contextSourcingRequestId: input.contextType === "SOURCING_REQUEST" ? input.contextRefId : undefined,
      contextResolutionCaseId: input.contextType === "RESOLUTION_CASE" ? input.contextRefId : undefined,
      senderUserId: input.staffUserId,
      body: input.body,
      senderIsStaff: true,
    });
    const firstMessage = created.messages.at(-1);
    if (firstMessage) {
      onMessagePersisted({ id: firstMessage.id, conversationId: created.id, senderIsStaff: true });
    }
    return ok({ conversationId: created.id });
  },

  /**
   * Vendor-side equivalent of staffStartOrContinueContextual (M9) — CrownSource
   * asking a Vendor for operational input on a resolution case, before the
   * Vendor has necessarily said anything themselves. Reuses the same
   * find-open-conversation-by-context dedup as every other contextual thread.
   */
  async staffStartOrContinueVendorContextual(input: {
    vendorId: string;
    staffUserId: string;
    contextResolutionCaseId: string;
    body: string;
  }): Promise<Result<{ conversationId: string }>> {
    if (input.body.trim().length === 0) return err("Write a message before sending.");

    const existing = await messagingRepository.findOpenVendorConversationByContext(input.vendorId, input.contextResolutionCaseId);
    if (existing) {
      const message = await messagingRepository.addMessage(existing.id, input.staffUserId, input.body, true);
      onMessagePersisted({ id: message.id, conversationId: existing.id, senderIsStaff: true });
      return ok({ conversationId: existing.id });
    }

    const created = await messagingRepository.createVendorConversation({
      vendorId: input.vendorId,
      contextResolutionCaseId: input.contextResolutionCaseId,
      senderUserId: input.staffUserId,
      body: input.body,
      senderIsStaff: true,
    });
    const firstMessage = created.messages.at(-1);
    if (firstMessage) {
      onMessagePersisted({ id: firstMessage.id, conversationId: created.id, senderIsStaff: true });
    }
    return ok({ conversationId: created.id });
  },
};
