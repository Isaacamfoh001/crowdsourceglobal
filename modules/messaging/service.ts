import { prisma } from "../../lib/db";
import { messagingRepository } from "./repository";
import { onMessagePersisted } from "./events";
import { catalogueRepository } from "../catalogue/repository";
import { vendorsRepository } from "../vendors/repository";
import { ok, err, type Result } from "../../lib/result";
import type { ConversationDetail, ConversationSummary, MessageView, AdminConversationSummary } from "./types";

type RawConversation = Awaited<ReturnType<typeof messagingRepository.findAllForAdmin>>[number];

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

  async listForCustomer(customerProfileId: string): Promise<ConversationSummary[]> {
    const rows = await messagingRepository.findCustomerConversations(customerProfileId);
    return rows.map(toSummary);
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
    contextType: "LISTING" | "VENDOR" | "ORDER" | "SOURCING_REQUEST";
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
      return ok({ conversationId: existing.id });
    }

    const created = await messagingRepository.createCustomerConversation({
      customerProfileId: input.customerProfileId,
      contextType: input.contextType,
      contextListingId: input.contextType === "LISTING" ? input.contextRefId : undefined,
      contextVendorId: input.contextType === "VENDOR" ? input.contextRefId : undefined,
      contextOrderId: input.contextType === "ORDER" ? input.contextRefId : undefined,
      contextSourcingRequestId: input.contextType === "SOURCING_REQUEST" ? input.contextRefId : undefined,
      senderUserId: input.senderUserId,
      body: input.body,
    });
    const firstMessage = created.messages.at(-1);
    if (firstMessage) {
      onMessagePersisted({ id: firstMessage.id, conversationId: created.id, senderIsStaff: false });
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
    return ok(null);
  },

  // --- Vendor ------------------------------------------------------------

  async listForVendor(vendorId: string): Promise<ConversationSummary[]> {
    const rows = await messagingRepository.findVendorConversations(vendorId);
    return rows.map(toSummary);
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
    return ok(null);
  },

  // --- Admin/staff -------------------------------------------------------

  async listForAdmin(status?: "OPEN" | "CLOSED"): Promise<AdminConversationSummary[]> {
    const rows = await messagingRepository.findAllForAdmin(status);
    return rows.map(toAdminSummary);
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
    contextType: "SOURCING_REQUEST";
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
      contextSourcingRequestId: input.contextRefId,
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
