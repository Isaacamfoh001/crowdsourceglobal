import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { CANCELLABLE_FULFILMENT_STATUSES } from "./policy";

const caseItemSelect = {
  id: true,
  orderItemId: true,
  fulfilmentItemId: true,
  quantityAffected: true,
  issueType: true,
  requestedResolution: true,
  approvedResolution: true,
  approvedRefundAmount: true,
  replacementQuantity: true,
  orderItem: { select: { description: true, quantity: true, unitPrice: true } },
} as const;

/** Admin-only extension — includes the affected Fulfilment/Vendor, never selected on the customer/vendor-facing shapes. */
const adminCaseItemSelect = {
  ...caseItemSelect,
  fulfilmentItem: { select: { fulfilment: { select: { id: true, vendorId: true, vendor: { select: { companyName: true } } } } } },
} as const;

const refundSelect = {
  id: true,
  itemsAmount: true,
  deliveryFeeAmount: true,
  amount: true,
  currency: true,
  status: true,
  failureReason: true,
  approvedAt: true,
  processedAt: true,
} as const;

const returnSelect = {
  id: true,
  status: true,
  method: true,
  trackingReference: true,
  notes: true,
  inspectionOutcome: true,
  restockedAt: true,
} as const;

const replacementSelect = {
  id: true,
  originalOrderItemId: true,
  quantity: true,
  replacementOrderItemId: true,
  replacementOrderItem: { select: { fulfilmentItems: { select: { fulfilmentId: true }, take: 1 } } },
} as const;

const customerDetailSelect = {
  id: true,
  caseNumber: true,
  status: true,
  issueType: true,
  customerDescription: true,
  customerSafeDecisionReason: true,
  orderId: true,
  order: { select: { orderNumber: true } },
  createdAt: true,
  resolvedAt: true,
  items: { select: caseItemSelect, orderBy: { createdAt: "asc" as const } },
  attachments: { select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
  refunds: { select: refundSelect, orderBy: { createdAt: "asc" as const } },
  returns: { select: { id: true, status: true, method: true, trackingReference: true }, orderBy: { createdAt: "asc" as const } },
  replacements: { select: replacementSelect, orderBy: { createdAt: "asc" as const } },
} as const;

const vendorDetailSelect = {
  id: true,
  caseNumber: true,
  status: true,
  issueType: true,
  fulfilmentId: true,
  order: { select: { orderNumber: true } },
  createdAt: true,
  items: {
    select: { quantityAffected: true, orderItem: { select: { description: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

const adminDetailSelect = {
  id: true,
  caseNumber: true,
  status: true,
  issueType: true,
  requestedResolution: true,
  responsibility: true,
  customerDescription: true,
  customerSafeDecisionReason: true,
  orderId: true,
  order: { select: { orderNumber: true } },
  fulfilmentId: true,
  customerProfile: { select: { displayName: true, user: { select: { name: true, email: true } } } },
  assignedStaffId: true,
  assignedStaff: { select: { user: { select: { name: true } } } },
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
  items: { select: adminCaseItemSelect, orderBy: { createdAt: "asc" as const } },
  attachments: { select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
  activities: { select: { id: true, type: true, metadata: true, createdAt: true }, orderBy: { createdAt: "desc" as const } },
  refunds: { select: refundSelect, orderBy: { createdAt: "asc" as const } },
  returns: { select: returnSelect, orderBy: { createdAt: "asc" as const } },
  replacements: { select: replacementSelect, orderBy: { createdAt: "asc" as const } },
} as const;

export const resolutionsRepository = {
  // --- Customer -----------------------------------------------------------

  findOrderForCancellationContext(orderId: string, customerProfileId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, customerProfileId },
      select: {
        id: true,
        orderNumber: true,
        fulfilments: {
          select: {
            id: true,
            status: true,
            vendor: { select: { companyName: true } },
            items: {
              select: { quantity: true, unitPrice: true, orderItem: { select: { id: true, description: true } } },
            },
          },
        },
      },
    });
  },

  findOrderItemsForOrder(orderId: string, orderItemIds: string[]) {
    return prisma.orderItem.findMany({
      where: { id: { in: orderItemIds }, orderId },
      select: { id: true, quantity: true, unitPrice: true, lineTotal: true, vendorId: true, fulfilmentItems: { select: { id: true, fulfilmentId: true } } },
    });
  },

  /** Duplicate-request protection (M9 §53) — scoped to still-open cases only, so a resolved/rejected case never blocks a genuinely new problem. */
  findOpenCaseForOrderItemAndIssue(orderItemId: string, issueType: string) {
    return prisma.resolutionCase.findFirst({
      where: {
        issueType: issueType as never,
        status: { notIn: ["RESOLVED", "REJECTED", "CLOSED"] },
        items: { some: { orderItemId } },
      },
      select: { id: true, caseNumber: true },
    });
  },

  async createCaseTransactional(input: {
    caseNumber: string;
    customerProfileId: string;
    orderId: string;
    fulfilmentId: string | null;
    issueType: string;
    requestedResolution: string | null;
    customerDescription: string;
    items: { orderItemId: string; fulfilmentItemId: string | null; quantityAffected: number; issueType: string; requestedResolution: string | null }[];
    submittedByUserId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.resolutionCase.create({
        data: {
          caseNumber: input.caseNumber,
          customerProfileId: input.customerProfileId,
          orderId: input.orderId,
          fulfilmentId: input.fulfilmentId,
          issueType: input.issueType as never,
          requestedResolution: input.requestedResolution as never,
          customerDescription: input.customerDescription,
        },
        select: { id: true, caseNumber: true },
      });
      await tx.resolutionCaseItem.createMany({
        data: input.items.map((item) => ({
          resolutionCaseId: created.id,
          orderItemId: item.orderItemId,
          fulfilmentItemId: item.fulfilmentItemId,
          quantityAffected: item.quantityAffected,
          issueType: item.issueType as never,
          requestedResolution: item.requestedResolution as never,
        })),
      });
      await tx.resolutionCaseActivity.create({
        data: { resolutionCaseId: created.id, type: "case_opened", actorUserId: input.submittedByUserId },
      });
      return created;
    });
  },

  listForCustomer(customerProfileId: string) {
    return prisma.resolutionCase.findMany({
      where: { customerProfileId },
      select: { id: true, caseNumber: true, status: true, issueType: true, orderId: true, order: { select: { orderNumber: true } }, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  },

  findForCustomer(caseId: string, customerProfileId: string) {
    return prisma.resolutionCase.findFirst({ where: { id: caseId, customerProfileId }, select: customerDetailSelect });
  },

  createAttachment(resolutionCaseId: string, data: { storageKey: string; filename: string; mimeType: string; sizeBytes: number; uploadedByUserId: string }) {
    return prisma.resolutionCaseAttachment.create({ data: { resolutionCaseId, ...data } });
  },

  findAttachmentForAccess(attachmentId: string) {
    return prisma.resolutionCaseAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        storageKey: true,
        filename: true,
        mimeType: true,
        resolutionCase: { select: { id: true, customerProfileId: true } },
      },
    });
  },

  // --- Vendor ---------------------------------------------------------------

  listForVendor(vendorId: string) {
    return prisma.resolutionCase.findMany({
      where: { items: { some: { fulfilmentItem: { fulfilment: { vendorId } } } } },
      select: { id: true, caseNumber: true, status: true, issueType: true, fulfilmentId: true, order: { select: { orderNumber: true } }, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  },

  findForVendor(caseId: string, vendorId: string) {
    return prisma.resolutionCase.findFirst({
      where: { id: caseId, items: { some: { fulfilmentItem: { fulfilment: { vendorId } } } } },
      select: vendorDetailSelect,
    });
  },

  // --- Admin ------------------------------------------------------------

  listForAdmin(filter: { status?: string; assignedStaffId?: string }) {
    return prisma.resolutionCase.findMany({
      where: {
        status: filter.status ? (filter.status as never) : undefined,
        assignedStaffId: filter.assignedStaffId,
      },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        issueType: true,
        orderId: true,
        order: { select: { orderNumber: true } },
        customerProfile: { select: { displayName: true, user: { select: { name: true } } } },
        assignedStaffId: true,
        assignedStaff: { select: { user: { select: { name: true } } } },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  },

  findForAdmin(caseId: string) {
    return prisma.resolutionCase.findUnique({ where: { id: caseId }, select: adminDetailSelect });
  },

  findStatusForUpdate(caseId: string) {
    return prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { id: true, status: true, caseNumber: true, customerProfileId: true } });
  },

  assignStaff(caseId: string, staffId: string | null) {
    return prisma.resolutionCase.update({ where: { id: caseId }, data: { assignedStaffId: staffId } });
  },

  async updateStatus(caseId: string, fromStatuses: string[], toStatus: string, extra: Record<string, unknown> = {}) {
    const result = await prisma.resolutionCase.updateMany({
      where: { id: caseId, status: { in: fromStatuses as never[] } },
      data: { status: toStatus as never, ...extra },
    });
    return result.count === 1;
  },

  createActivity(resolutionCaseId: string, type: string, actorUserId: string | null, metadata?: Record<string, unknown>) {
    return prisma.resolutionCaseActivity.create({
      data: { resolutionCaseId, type, actorUserId, metadata: metadata as Prisma.InputJsonValue },
    });
  },

  // --- Refund cap / duplicate-quantity validation (M9 §12/§58) -----------

  async sumApprovedRefundForOrderItem(orderItemId: string): Promise<number> {
    const result = await prisma.resolutionCaseItem.aggregate({
      where: { orderItemId, approvedRefundAmount: { not: null } },
      _sum: { approvedRefundAmount: true },
    });
    return result._sum.approvedRefundAmount?.toNumber() ?? 0;
  },

  async sumResolvedQuantityForOrderItem(orderItemId: string): Promise<number> {
    const result = await prisma.resolutionCaseItem.aggregate({
      where: { orderItemId, approvedResolution: { not: null, notIn: ["NO_ACTION"] } },
      _sum: { quantityAffected: true },
    });
    return result._sum.quantityAffected ?? 0;
  },

  // --- Approval transaction (the core M9 side-effect engine) --------------

  async approveResolutionTransactional(params: {
    caseId: string;
    fromStatuses: string[];
    responsibility: string;
    customerSafeDecisionReason: string;
    itemDecisions: { caseItemId: string; approvedResolution: string; approvedRefundAmount: number | null; replacementQuantity: number | null }[];
    refund: { itemsAmount: number; deliveryFeeAmount: number; orderId: string; caseItemIdsToLink: string[] } | null;
    returnNeeded: boolean;
    replacements: { originalOrderItemId: string; quantity: number }[];
    payoutHoldFulfilmentItemIds: string[];
    payoutHoldReason: string;
    cancelFulfilment: { fulfilmentId: string; orderId: string; orderItemIds: string[] } | null;
    actorUserId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.resolutionCase.updateMany({
        where: { id: params.caseId, status: { in: params.fromStatuses as never[] } },
        data: {
          status: "RESOLUTION_APPROVED",
          responsibility: params.responsibility as never,
          customerSafeDecisionReason: params.customerSafeDecisionReason,
        },
      });
      if (claimed.count !== 1) return null;

      for (const decision of params.itemDecisions) {
        await tx.resolutionCaseItem.update({
          where: { id: decision.caseItemId },
          data: {
            approvedResolution: decision.approvedResolution as never,
            approvedRefundAmount: decision.approvedRefundAmount,
            replacementQuantity: decision.replacementQuantity,
          },
        });
      }

      let refundId: string | null = null;
      if (params.refund) {
        const refund = await tx.refund.create({
          data: {
            resolutionCaseId: params.caseId,
            orderId: params.refund.orderId,
            itemsAmount: params.refund.itemsAmount,
            deliveryFeeAmount: params.refund.deliveryFeeAmount,
            amount: params.refund.itemsAmount + params.refund.deliveryFeeAmount,
            status: "APPROVED",
            approvedAt: new Date(),
          },
        });
        refundId = refund.id;
        await tx.resolutionCaseItem.updateMany({
          where: { id: { in: params.refund.caseItemIdsToLink } },
          data: { refundId: refund.id },
        });
      }

      let returnId: string | null = null;
      if (params.returnNeeded) {
        const created = await tx.return.create({ data: { resolutionCaseId: params.caseId, status: "APPROVED" } });
        returnId = created.id;
      }

      const replacementIds: string[] = [];
      for (const replacement of params.replacements) {
        const created = await tx.replacement.create({
          data: { resolutionCaseId: params.caseId, originalOrderItemId: replacement.originalOrderItemId, quantity: replacement.quantity },
        });
        replacementIds.push(created.id);
      }

      if (params.payoutHoldFulfilmentItemIds.length > 0) {
        await tx.fulfilmentItem.updateMany({
          where: { id: { in: params.payoutHoldFulfilmentItemIds } },
          data: { payoutHold: true, payoutHoldReason: params.payoutHoldReason },
        });
      }

      let fulfilmentCancelled = false;
      if (params.cancelFulfilment) {
        const cancelled = await tx.fulfilment.updateMany({
          where: { id: params.cancelFulfilment.fulfilmentId, status: { in: CANCELLABLE_FULFILMENT_STATUSES as never[] } },
          data: { status: "CANCELLED" },
        });
        fulfilmentCancelled = cancelled.count === 1;
        if (fulfilmentCancelled) {
          for (const orderItemId of params.cancelFulfilment.orderItemIds) {
            const orderItem = await tx.orderItem.findUnique({ where: { id: orderItemId }, select: { listingId: true, quantity: true } });
            if (!orderItem?.listingId) continue;
            // Scoped to THIS order's reservation for THIS listing — never a
            // blanket release across other orders holding the same listing.
            const releasedReservation = await tx.inventoryReservation.updateMany({
              where: { orderId: params.cancelFulfilment.orderId, listingId: orderItem.listingId, status: { in: ["HELD", "COMMITTED"] } },
              data: { status: "RELEASED" },
            });
            if (releasedReservation.count > 0) {
              await tx.vendorListing.update({
                where: { id: orderItem.listingId },
                data: { availableQuantity: { increment: orderItem.quantity } },
              });
            }
          }
        }
      }

      await tx.resolutionCaseActivity.create({
        data: {
          resolutionCaseId: params.caseId,
          type: "resolution_approved",
          actorUserId: params.actorUserId,
          metadata: { responsibility: params.responsibility, refundId, returnId, replacementIds, fulfilmentCancelled } as Prisma.InputJsonValue,
        },
      });

      return { refundId, returnId, replacementIds, fulfilmentCancelled };
    });
  },

  // --- Refund execution ----------------------------------------------------

  findRefundForExecution(refundId: string) {
    return prisma.refund.findUnique({
      where: { id: refundId },
      select: { id: true, resolutionCaseId: true, orderId: true, amount: true, currency: true, status: true },
    });
  },

  async claimRefundForProcessing(refundId: string) {
    const result = await prisma.refund.updateMany({
      where: { id: refundId, status: { in: ["APPROVED", "FAILED"] } },
      data: { status: "PROCESSING" },
    });
    return result.count === 1;
  },

  markRefundCompleted(refundId: string, providerEventId: string) {
    return prisma.refund.update({ where: { id: refundId }, data: { status: "COMPLETED", processedAt: new Date(), providerEventId, failureReason: null } });
  },

  markRefundFailed(refundId: string, failureReason: string) {
    return prisma.refund.update({ where: { id: refundId }, data: { status: "FAILED", failureReason } });
  },

  // --- Return lifecycle ------------------------------------------------

  findReturnForUpdate(returnId: string) {
    return prisma.return.findUnique({ where: { id: returnId }, select: { id: true, resolutionCaseId: true, status: true } });
  },

  async updateReturnStatus(returnId: string, fromStatuses: string[], toStatus: string, extra: Record<string, unknown> = {}) {
    const result = await prisma.return.updateMany({
      where: { id: returnId, status: { in: fromStatuses as never[] } },
      data: { status: toStatus as never, ...extra },
    });
    return result.count === 1;
  },

  /** Guarded, idempotent restock — `restockedAt: null` in the WHERE clause is the whole guarantee. */
  async restockFromReturnTransactional(returnId: string, lines: { listingId: string; quantity: number }[]) {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.return.updateMany({
        where: { id: returnId, restockedAt: null },
        data: { restockedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      for (const line of lines) {
        await tx.vendorListing.update({ where: { id: line.listingId }, data: { availableQuantity: { increment: line.quantity } } });
      }
      return true;
    });
  },

  findReturnLinesForRestock(resolutionCaseId: string) {
    return prisma.resolutionCaseItem.findMany({
      where: { resolutionCaseId, approvedResolution: { in: ["RETURN_AND_REFUND", "RETURN_AND_REPLACEMENT"] } },
      select: { quantityAffected: true, orderItem: { select: { listingId: true } } },
    });
  },

  // --- Replacement fulfilment creation ------------------------------------

  findReplacementForCreation(replacementId: string) {
    return prisma.replacement.findUnique({
      where: { id: replacementId },
      select: {
        id: true,
        resolutionCaseId: true,
        quantity: true,
        replacementOrderItemId: true,
        originalOrderItem: {
          select: { id: true, orderId: true, description: true, listingId: true, vendorId: true, unitPrice: true },
        },
      },
    });
  },

  async createReplacementFulfilmentTransactional(params: {
    replacementId: string;
    orderId: string;
    vendorId: string;
    origin: "DOMESTIC_COLLECTION" | "INTERNATIONAL_INBOUND";
    listingId: string | null;
    description: string;
    quantity: number;
    defaultReceivingLocationId: string | null;
  }) {
    return prisma.$transaction(async (tx) => {
      if (params.listingId) {
        const decremented = await tx.vendorListing.updateMany({
          where: { id: params.listingId, availableQuantity: { gte: params.quantity } },
          data: { availableQuantity: { decrement: params.quantity } },
        });
        if (decremented.count !== 1) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

      const orderItem = await tx.orderItem.create({
        data: {
          orderId: params.orderId,
          listingId: params.listingId,
          vendorId: params.vendorId,
          description: `Replacement: ${params.description}`,
          quantity: params.quantity,
          unitPrice: 0,
          vendorPayableBasis: 0,
          lineTotal: 0,
        },
      });

      const fulfilment = await tx.fulfilment.create({ data: { orderId: params.orderId, vendorId: params.vendorId, origin: params.origin } });
      await tx.fulfilmentItem.create({
        data: { fulfilmentId: fulfilment.id, orderItemId: orderItem.id, quantity: params.quantity, unitPrice: 0, vendorPayableBasis: 0 },
      });
      await tx.shipment.create({
        data: {
          fulfilmentId: fulfilment.id,
          receivingLocationId: params.origin === "INTERNATIONAL_INBOUND" ? (params.defaultReceivingLocationId ?? undefined) : undefined,
        },
      });
      await tx.replacement.update({ where: { id: params.replacementId }, data: { replacementOrderItemId: orderItem.id } });

      return { fulfilmentId: fulfilment.id, orderItemId: orderItem.id };
    });
  },

  findDefaultReceivingLocationId() {
    return prisma.receivingLocation.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  },

  // --- Notification context -------------------------------------------------

  findCaseContextForNotification(caseId: string) {
    return prisma.resolutionCase.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        caseNumber: true,
        order: { select: { orderNumber: true } },
        customerProfile: { select: { userId: true, user: { select: { email: true } } } },
      },
    });
  },

  findVendorContextsForCase(caseId: string) {
    return prisma.resolutionCase.findUnique({
      where: { id: caseId },
      select: {
        items: { select: { fulfilmentItem: { select: { fulfilment: { select: { vendorId: true } } } } } },
      },
    });
  },
};
