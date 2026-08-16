import { prisma } from "../../lib/db";

const conversationInclude = {
  contextListing: { select: { id: true, title: true, vendor: { select: { companyName: true } } } },
  contextVendor: { select: { id: true, companyName: true } },
  contextOrder: { select: { id: true, orderNumber: true } },
  vendor: { select: { id: true, companyName: true } },
  customerProfile: { select: { id: true, displayName: true, user: { select: { name: true, email: true } } } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { senderUser: { select: { name: true } } },
  },
} as const;

export const messagingRepository = {
  // --- Customer side ---------------------------------------------------

  findCustomerConversations(customerProfileId: string) {
    return prisma.conversation.findMany({
      where: { participantType: "CUSTOMER", customerProfileId },
      include: conversationInclude,
      orderBy: { updatedAt: "desc" },
    });
  },

  findCustomerConversationById(customerProfileId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, participantType: "CUSTOMER", customerProfileId },
      include: conversationInclude,
    });
  },

  findOpenCustomerConversationByContext(
    customerProfileId: string,
    contextType: "LISTING" | "VENDOR",
    contextRefId: string,
  ) {
    return prisma.conversation.findFirst({
      where: {
        participantType: "CUSTOMER",
        customerProfileId,
        status: "OPEN",
        ...(contextType === "LISTING" ? { contextListingId: contextRefId } : { contextVendorId: contextRefId }),
      },
      include: conversationInclude,
    });
  },

  async createCustomerConversation(input: {
    customerProfileId: string;
    contextType: "LISTING" | "VENDOR" | "GENERAL";
    contextListingId?: string;
    contextVendorId?: string;
    senderUserId: string;
    body: string;
  }) {
    return prisma.conversation.create({
      data: {
        participantType: "CUSTOMER",
        contextType: input.contextType,
        customerProfileId: input.customerProfileId,
        contextListingId: input.contextListingId,
        contextVendorId: input.contextVendorId,
        messages: { create: { senderUserId: input.senderUserId, body: input.body, senderIsStaff: false } },
      },
      include: conversationInclude,
    });
  },

  // --- Vendor side -------------------------------------------------------

  findVendorConversations(vendorId: string) {
    return prisma.conversation.findMany({
      where: { participantType: "VENDOR", vendorId },
      include: conversationInclude,
      orderBy: { updatedAt: "desc" },
    });
  },

  findVendorConversationById(vendorId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, participantType: "VENDOR", vendorId },
      include: conversationInclude,
    });
  },

  async createVendorConversation(input: { vendorId: string; senderUserId: string; body: string }) {
    return prisma.conversation.create({
      data: {
        participantType: "VENDOR",
        contextType: "GENERAL",
        vendorId: input.vendorId,
        messages: { create: { senderUserId: input.senderUserId, body: input.body, senderIsStaff: false } },
      },
      include: conversationInclude,
    });
  },

  // --- Shared --------------------------------------------------------

  async addMessage(conversationId: string, senderUserId: string, body: string, senderIsStaff: boolean) {
    const [message] = await prisma.$transaction([
      prisma.message.create({ data: { conversationId, senderUserId, body, senderIsStaff } }),
      prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);
    return message;
  },

  // --- Admin -----------------------------------------------------------

  findAllForAdmin(status?: "OPEN" | "CLOSED") {
    return prisma.conversation.findMany({
      where: status ? { status } : undefined,
      include: conversationInclude,
      orderBy: { updatedAt: "desc" },
    });
  },

  findByIdForAdmin(conversationId: string) {
    return prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
  },
};
