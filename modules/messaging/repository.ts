import { prisma } from "../../lib/db";
import { paginationSkip } from "../../lib/pagination";

const contextSelect = {
  contextListing: { select: { id: true, title: true, vendor: { select: { companyName: true } } } },
  contextVendor: { select: { id: true, companyName: true } },
  contextOrder: { select: { id: true, orderNumber: true } },
  contextSourcingRequest: { select: { id: true, requestNumber: true } },
  contextResolutionCase: { select: { id: true, caseNumber: true } },
  vendor: { select: { id: true, companyName: true } },
  customerProfile: { select: { id: true, userId: true, displayName: true, user: { select: { name: true, email: true } } } },
} as const;

// createdAt first, id as a deterministic tie-breaker for messages created
// within the same timestamp tick (cuid is time-ordered, so this gives
// stable ordering without needing a separate sequence column).
const messageOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];

const conversationInclude = {
  ...contextSelect,
  messages: {
    orderBy: messageOrder,
    include: { senderUser: { select: { name: true } } },
  },
};

/**
 * List views only ever render the most recent message as a preview — not
 * the full thread. Reusing `conversationInclude` there would pull every
 * historical message for every conversation in the inbox just to read the
 * last one; this fetches exactly one message per conversation instead.
 */
const conversationSummaryInclude = {
  ...contextSelect,
  messages: {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 1,
    include: { senderUser: { select: { name: true } } },
  },
};

export const messagingRepository = {
  // --- Customer side ---------------------------------------------------

  async findCustomerConversations(customerProfileId: string, page: number, pageSize: number) {
    const where = { participantType: "CUSTOMER" as const, customerProfileId };
    const [rows, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: conversationSummaryInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.conversation.count({ where }),
    ]);
    return { rows, total };
  },

  findCustomerConversationById(customerProfileId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, participantType: "CUSTOMER", customerProfileId },
      include: conversationInclude,
    });
  },

  findOpenCustomerConversationByContext(
    customerProfileId: string,
    contextType: "LISTING" | "VENDOR" | "ORDER" | "SOURCING_REQUEST" | "RESOLUTION_CASE",
    contextRefId: string,
  ) {
    const contextField =
      contextType === "LISTING"
        ? "contextListingId"
        : contextType === "VENDOR"
          ? "contextVendorId"
          : contextType === "ORDER"
            ? "contextOrderId"
            : contextType === "SOURCING_REQUEST"
              ? "contextSourcingRequestId"
              : "contextResolutionCaseId";
    return prisma.conversation.findFirst({
      where: {
        participantType: "CUSTOMER",
        customerProfileId,
        status: "OPEN",
        [contextField]: contextRefId,
      },
      include: conversationInclude,
    });
  },

  async createCustomerConversation(input: {
    customerProfileId: string;
    contextType: "LISTING" | "VENDOR" | "ORDER" | "SOURCING_REQUEST" | "RESOLUTION_CASE" | "GENERAL";
    contextListingId?: string;
    contextVendorId?: string;
    contextOrderId?: string;
    contextSourcingRequestId?: string;
    contextResolutionCaseId?: string;
    senderUserId: string;
    body: string;
    /** True when CrownSource staff initiates the thread (M6 clarification-request flow) rather than the customer. */
    senderIsStaff?: boolean;
  }) {
    return prisma.conversation.create({
      data: {
        participantType: "CUSTOMER",
        contextType: input.contextType,
        customerProfileId: input.customerProfileId,
        contextListingId: input.contextListingId,
        contextVendorId: input.contextVendorId,
        contextOrderId: input.contextOrderId,
        contextSourcingRequestId: input.contextSourcingRequestId,
        contextResolutionCaseId: input.contextResolutionCaseId,
        messages: {
          create: { senderUserId: input.senderUserId, body: input.body, senderIsStaff: input.senderIsStaff ?? false },
        },
      },
      include: conversationInclude,
    });
  },

  // --- Vendor side -------------------------------------------------------

  async findVendorConversations(vendorId: string, page: number, pageSize: number) {
    const where = { participantType: "VENDOR" as const, vendorId };
    const [rows, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: conversationSummaryInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.conversation.count({ where }),
    ]);
    return { rows, total };
  },

  findVendorConversationById(vendorId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, participantType: "VENDOR", vendorId },
      include: conversationInclude,
    });
  },

  /** Vendor-side equivalent of findOpenCustomerConversationByContext — only RESOLUTION_CASE uses context on the vendor side today. */
  findOpenVendorConversationByContext(vendorId: string, contextResolutionCaseId: string) {
    return prisma.conversation.findFirst({
      where: { participantType: "VENDOR", vendorId, status: "OPEN", contextResolutionCaseId },
      include: conversationInclude,
    });
  },

  async createVendorConversation(input: { vendorId: string; senderUserId: string; body: string; contextResolutionCaseId?: string; senderIsStaff?: boolean }) {
    return prisma.conversation.create({
      data: {
        participantType: "VENDOR",
        contextType: input.contextResolutionCaseId ? "RESOLUTION_CASE" : "GENERAL",
        vendorId: input.vendorId,
        contextResolutionCaseId: input.contextResolutionCaseId,
        messages: { create: { senderUserId: input.senderUserId, body: input.body, senderIsStaff: input.senderIsStaff ?? false } },
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

  async findAllForAdmin(status: "OPEN" | "CLOSED" | undefined, page: number, pageSize: number) {
    const where = status ? { status } : undefined;
    const [rows, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: conversationSummaryInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.conversation.count({ where }),
    ]);
    return { rows, total };
  },

  findByIdForAdmin(conversationId: string) {
    return prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
  },

  /**
   * For the M8 admin-dashboard attention aggregation only — deliberately
   * never selects `Message.body`. A conversation "needs a staff reply" is
   * derivable from who sent the *last* message and when, without ever
   * pulling message content into a cross-module dashboard summary (see
   * docs/architecture/overview.md's privacy review — message content stays
   * behind the authorized single-conversation view).
   */
  findOpenConversationsForAttention() {
    return prisma.conversation.findMany({
      where: { status: "OPEN" },
      select: {
        id: true,
        participantType: true,
        updatedAt: true,
        customerProfile: { select: { displayName: true } },
        vendor: { select: { companyName: true } },
        messages: {
          orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
          take: 1,
          select: { senderIsStaff: true, createdAt: true },
        },
      },
    });
  },
};
