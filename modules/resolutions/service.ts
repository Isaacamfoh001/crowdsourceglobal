import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { resolutionsRepository } from "./repository";
import { ordersRepository } from "../orders/repository";
import { vendorsRepository } from "../vendors/repository";
import { administrationRepository } from "../administration/repository";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { getRefundExecutorForPaymentProvider, type RefundExecutor } from "../refunds/executor";
import { paystackClient } from "../payments/providers/paystack/client";
import { generateResolutionCaseNumber } from "../../lib/resolution-number";
import { storageProvider, generateStorageKey } from "../../lib/storage";
import { validateAttachment, sanitizeFilename } from "../../lib/attachment-validation";
import {
  classifyCancellationEligibility,
  CANCELLABLE_FULFILMENT_STATUSES,
  validateRefundAmount,
  validateQuantity,
  isRefundBearing,
  requiresReturn,
  isReplacement,
} from "./policy";
import { ok, err, type Result } from "../../lib/result";
import type { MockRefundOutcome } from "../refunds/types";
import type {
  AdminCaseDetail,
  AdminCaseSummary,
  ApproveResolutionInput,
  CaseItemView,
  CustomerCaseDetail,
  CustomerCaseSummary,
  OrderCancellationContext,
  ResolutionCaseStatus,
  SubmitCaseInput,
  VendorCaseDetail,
  VendorCaseSummary,
} from "./types";

const STATUS_LABELS: Record<ResolutionCaseStatus, string> = {
  OPEN: "Open",
  UNDER_REVIEW: "Under review",
  AWAITING_CUSTOMER: "Awaiting your reply",
  AWAITING_VENDOR: "Awaiting vendor",
  RESOLUTION_APPROVED: "Resolution approved",
  RESOLUTION_IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  REJECTED: "Not approved",
  CLOSED: "Closed",
};

function toCaseItemView(row: {
  id: string;
  orderItemId: string;
  quantityAffected: number;
  issueType: string;
  requestedResolution: string | null;
  approvedResolution: string | null;
  approvedRefundAmount: Prisma.Decimal | null;
  replacementQuantity: number | null;
  orderItem: { description: string; quantity: number; unitPrice: Prisma.Decimal };
}): CaseItemView {
  return {
    id: row.id,
    orderItemId: row.orderItemId,
    description: row.orderItem.description,
    quantityAffected: row.quantityAffected,
    purchasedQuantity: row.orderItem.quantity,
    unitPrice: row.orderItem.unitPrice.toNumber(),
    issueType: row.issueType as CaseItemView["issueType"],
    requestedResolution: row.requestedResolution as CaseItemView["requestedResolution"],
    approvedResolution: row.approvedResolution as CaseItemView["approvedResolution"],
    approvedRefundAmount: row.approvedRefundAmount?.toNumber() ?? null,
    replacementQuantity: row.replacementQuantity,
  };
}

async function notifyAdminsOfNewCase(caseId: string, caseNumber: string, issueType: string, orderNumber: string): Promise<void> {
  const admins = await administrationRepository.listAllForNotification();
  for (const admin of admins) {
    await notificationsService.notify({
      recipientUserId: admin.userId,
      type: "ADMIN_NEW_RESOLUTION_CASE",
      title: "New resolution case",
      body: `New case ${caseNumber}: ${issueType} on order ${orderNumber}.`,
      targetUrl: notificationLinks.adminResolution(caseId),
      eventKey: `admin-new-resolution-case:${caseId}:${admin.userId}`,
      email: {
        to: admin.user.email,
        subject: "New resolution case",
        templateKey: "admin-new-resolution-case",
        templateData: { caseNumber, issueType, orderNumber, caseId },
      },
    });
  }
}

async function notifyRefundCompleted(refundId: string, resolutionCaseId: string, amount: number, currency: string): Promise<void> {
  const context = await resolutionsRepository.findCaseContextForNotification(resolutionCaseId);
  if (!context) return;
  await notificationsService.notify({
    recipientUserId: context.customerProfile.userId,
    type: "REFUND_COMPLETED",
    title: "Your refund is complete",
    body: `Your refund for case ${context.caseNumber} has been completed.`,
    targetUrl: notificationLinks.customerResolution(resolutionCaseId),
    eventKey: `refund-completed:${refundId}`,
    email: {
      to: context.customerProfile.user.email,
      subject: "Your refund is complete",
      templateKey: "refund-completed",
      templateData: { caseNumber: context.caseNumber, amount, currency, caseId: resolutionCaseId },
    },
  });
}

async function notifyRefundFailed(refundId: string, resolutionCaseId: string): Promise<void> {
  const admins = await administrationRepository.listAllForNotification();
  const caseRow = await resolutionsRepository.findStatusForUpdate(resolutionCaseId);
  for (const admin of admins) {
    await notificationsService.notify({
      recipientUserId: admin.userId,
      type: "ADMIN_REFUND_FAILED",
      title: "Refund failed",
      body: `A refund for case ${caseRow?.caseNumber ?? resolutionCaseId} failed to process and needs attention.`,
      targetUrl: notificationLinks.adminResolution(resolutionCaseId),
      eventKey: `admin-refund-failed:${refundId}:${admin.userId}`,
      email: {
        to: admin.user.email,
        subject: "Refund failed",
        templateKey: "admin-refund-failed",
        templateData: { caseNumber: caseRow?.caseNumber ?? "", caseId: resolutionCaseId },
      },
    });
  }
}

/** Every vendor whose Fulfilment is touched by this case's items — a case can, in principle, span more than one vendor. */
async function findAffectedVendorIds(caseId: string): Promise<string[]> {
  const context = await resolutionsRepository.findVendorContextsForCase(caseId);
  const vendorIds = new Set<string>();
  for (const item of context?.items ?? []) {
    const vendorId = item.fulfilmentItem?.fulfilment.vendorId;
    if (vendorId) vendorIds.add(vendorId);
  }
  return [...vendorIds];
}

export const resolutionsService = {
  // --- Customer ----------------------------------------------------------

  async getOrderContextForCustomer(orderId: string, customerProfileId: string): Promise<OrderCancellationContext | null> {
    const order = await resolutionsRepository.findOrderForCancellationContext(orderId, customerProfileId);
    if (!order) return null;
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      fulfilments: order.fulfilments.map((f) => ({
        fulfilmentId: f.id,
        vendorName: f.vendor.companyName,
        status: f.status,
        eligibility: classifyCancellationEligibility(f.status),
        items: f.items.map((item) => ({
          orderItemId: item.orderItem.id,
          description: item.orderItem.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toNumber(),
        })),
      })),
    };
  },

  async submitCase(customerProfileId: string, submittedByUserId: string, input: SubmitCaseInput): Promise<Result<{ caseId: string; caseNumber: string }>> {
    if (input.description.trim().length < 5) return err("Describe what happened in a bit more detail.");
    if (input.items.length === 0) return err("Select at least one affected item.");

    const order = await ordersRepository.findByIdForCustomer(input.orderId, customerProfileId);
    if (!order) return err("Order not found.");

    const orderItemIds = input.items.map((item) => item.orderItemId);
    const orderItems = await resolutionsRepository.findOrderItemsForOrder(input.orderId, orderItemIds);
    if (orderItems.length !== orderItemIds.length) return err("One or more items don't belong to this order.");

    const preparedItems: { orderItemId: string; fulfilmentItemId: string | null; quantityAffected: number; issueType: string; requestedResolution: string | null }[] = [];

    for (const requested of input.items) {
      const orderItem = orderItems.find((item) => item.id === requested.orderItemId)!;

      const alreadyResolved = await resolutionsRepository.sumResolvedQuantityForOrderItem(orderItem.id);
      const quantityCheck = validateQuantity({ requestedQuantity: requested.quantity, alreadyResolvedQuantity: alreadyResolved, purchasedQuantity: orderItem.quantity });
      if (!quantityCheck.ok) return err(quantityCheck.error);

      const duplicate = await resolutionsRepository.findOpenCaseForOrderItemAndIssue(orderItem.id, input.issueType);
      if (duplicate) return err(`This item already has an open case (${duplicate.caseNumber}) for this issue.`);

      if (input.issueType === "CUSTOMER_CANCELLATION_REQUEST") {
        const fulfilmentItem = orderItem.fulfilmentItems[0];
        if (fulfilmentItem) {
          const fulfilment = await prisma.fulfilment.findUnique({ where: { id: fulfilmentItem.fulfilmentId }, select: { status: true } });
          if (fulfilment && classifyCancellationEligibility(fulfilment.status) === "BLOCKED") {
            return err("This order has already been delivered and can no longer be cancelled — please report a problem instead.");
          }
        }
      }

      preparedItems.push({
        orderItemId: orderItem.id,
        fulfilmentItemId: orderItem.fulfilmentItems[0]?.id ?? null,
        quantityAffected: requested.quantity,
        issueType: input.issueType,
        requestedResolution: input.requestedResolution ?? null,
      });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await resolutionsRepository.createCaseTransactional({
          caseNumber: generateResolutionCaseNumber(),
          customerProfileId,
          orderId: input.orderId,
          fulfilmentId: input.fulfilmentId ?? null,
          issueType: input.issueType,
          requestedResolution: input.requestedResolution ?? null,
          customerDescription: input.description.trim(),
          items: preparedItems,
          submittedByUserId,
        });

        const submitter = await prisma.user.findUnique({ where: { id: submittedByUserId }, select: { email: true } });
        await notificationsService.notify({
          recipientUserId: submittedByUserId,
          type: "RESOLUTION_CASE_RECEIVED",
          title: "We've received your report",
          body: `We've received your report on order ${order.orderNumber} (case ${created.caseNumber}).`,
          targetUrl: notificationLinks.customerResolution(created.id),
          eventKey: `resolution-case-received:${created.id}`,
          email: submitter
            ? {
                to: submitter.email,
                subject: "We've received your report",
                templateKey: "resolution-case-received",
                templateData: { orderNumber: order.orderNumber, caseNumber: created.caseNumber, caseId: created.id },
              }
            : undefined,
        });

        await notifyAdminsOfNewCase(created.id, created.caseNumber, input.issueType, order.orderNumber);

        return ok({ caseId: created.id, caseNumber: created.caseNumber });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 2) {
          continue; // caseNumber collision — retry with a freshly generated one
        }
        console.error("Resolution case submission failed unexpectedly:", error);
        return err("Something went wrong submitting your report. Please try again.");
      }
    }
    return err("Something went wrong submitting your report. Please try again.");
  },

  async listForCustomer(customerProfileId: string): Promise<CustomerCaseSummary[]> {
    const rows = await resolutionsRepository.listForCustomer(customerProfileId);
    return rows.map((row) => ({
      id: row.id,
      caseNumber: row.caseNumber,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      issueType: row.issueType,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      createdAt: row.createdAt,
    }));
  },

  async getForCustomer(customerProfileId: string, caseId: string): Promise<CustomerCaseDetail | null> {
    const row = await resolutionsRepository.findForCustomer(caseId, customerProfileId);
    if (!row) return null;
    return {
      id: row.id,
      caseNumber: row.caseNumber,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      issueType: row.issueType,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      createdAt: row.createdAt,
      customerDescription: row.customerDescription,
      customerSafeDecisionReason: row.customerSafeDecisionReason,
      items: row.items.map(toCaseItemView),
      attachments: row.attachments,
      refunds: row.refunds.map((r) => ({ id: r.id, amount: r.amount.toNumber(), currency: r.currency, status: r.status, approvedAt: r.approvedAt, processedAt: r.processedAt })),
      returns: row.returns,
      replacements: row.replacements.map((r) => ({ id: r.id, quantity: r.quantity, replacementFulfilmentId: r.replacementOrderItem?.fulfilmentItems[0]?.fulfilmentId ?? null })),
      resolvedAt: row.resolvedAt,
    };
  },

  // --- Vendor ---------------------------------------------------------------

  async listForVendor(vendorId: string): Promise<VendorCaseSummary[]> {
    const rows = await resolutionsRepository.listForVendor(vendorId);
    return rows.map((row) => ({
      id: row.id,
      caseNumber: row.caseNumber,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      issueType: row.issueType,
      fulfilmentId: row.fulfilmentId,
      orderNumber: row.order.orderNumber,
      createdAt: row.createdAt,
    }));
  },

  async getForVendor(vendorId: string, caseId: string): Promise<VendorCaseDetail | null> {
    const row = await resolutionsRepository.findForVendor(caseId, vendorId);
    if (!row) return null;
    return {
      id: row.id,
      caseNumber: row.caseNumber,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      issueType: row.issueType,
      fulfilmentId: row.fulfilmentId,
      orderNumber: row.order.orderNumber,
      createdAt: row.createdAt,
      items: row.items.map((item) => ({ description: item.orderItem.description, quantityAffected: item.quantityAffected })),
    };
  },

  // --- Admin -----------------------------------------------------------

  async listForAdmin(filter: { status?: string; assignedStaffId?: string }): Promise<AdminCaseSummary[]> {
    const rows = await resolutionsRepository.listForAdmin(filter);
    return rows.map((row) => ({
      id: row.id,
      caseNumber: row.caseNumber,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      issueType: row.issueType,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      customerName: row.customerProfile.displayName ?? row.customerProfile.user.name,
      assignedStaffId: row.assignedStaffId,
      assignedStaffName: row.assignedStaff?.user.name ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },

  async getDetailForAdmin(caseId: string): Promise<AdminCaseDetail | null> {
    const row = await resolutionsRepository.findForAdmin(caseId);
    if (!row) return null;

    const vendorsById = new Map<string, { vendorId: string; vendorName: string; fulfilmentId: string }>();
    for (const item of row.items) {
      const fulfilment = item.fulfilmentItem?.fulfilment;
      if (fulfilment && !vendorsById.has(fulfilment.vendorId)) {
        vendorsById.set(fulfilment.vendorId, { vendorId: fulfilment.vendorId, vendorName: fulfilment.vendor.companyName, fulfilmentId: fulfilment.id });
      }
    }

    return {
      id: row.id,
      caseNumber: row.caseNumber,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      issueType: row.issueType,
      orderId: row.orderId,
      orderNumber: row.order.orderNumber,
      customerName: row.customerProfile.displayName ?? row.customerProfile.user.name,
      customerEmail: row.customerProfile.user.email,
      customerDescription: row.customerDescription,
      customerSafeDecisionReason: row.customerSafeDecisionReason,
      requestedResolution: row.requestedResolution,
      responsibility: row.responsibility,
      fulfilmentId: row.fulfilmentId,
      assignedStaffId: row.assignedStaffId,
      assignedStaffName: row.assignedStaff?.user.name ?? null,
      items: row.items.map(toCaseItemView),
      affectedVendors: [...vendorsById.values()],
      attachments: row.attachments,
      activities: row.activities.map((a) => ({ id: a.id, type: a.type, createdAt: a.createdAt, metadata: a.metadata as Record<string, unknown> | null })),
      refunds: row.refunds.map((r) => ({
        id: r.id,
        itemsAmount: r.itemsAmount.toNumber(),
        deliveryFeeAmount: r.deliveryFeeAmount.toNumber(),
        amount: r.amount.toNumber(),
        currency: r.currency,
        status: r.status,
        failureReason: r.failureReason,
        approvedAt: r.approvedAt,
        processedAt: r.processedAt,
        paymentProvider: r.payment?.provider ?? null,
        providerReference: r.providerEventId,
      })),
      returns: row.returns,
      replacements: row.replacements.map((r) => ({
        id: r.id,
        originalOrderItemId: r.originalOrderItemId,
        quantity: r.quantity,
        replacementOrderItemId: r.replacementOrderItemId,
        replacementFulfilmentId: r.replacementOrderItem?.fulfilmentItems[0]?.fulfilmentId ?? null,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resolvedAt: row.resolvedAt,
      closedAt: row.closedAt,
    };
  },

  async assignStaff(caseId: string, staffId: string | null): Promise<Result<null>> {
    await resolutionsRepository.assignStaff(caseId, staffId);
    return ok(null);
  },

  async moveToUnderReview(staffId: string, caseId: string): Promise<Result<null>> {
    const applied = await resolutionsRepository.updateStatus(caseId, ["OPEN"], "UNDER_REVIEW");
    if (!applied) return err("This case can't move to review right now.");
    await resolutionsRepository.createActivity(caseId, "review_started", staffId);
    return ok(null);
  },

  async requestCustomerClarification(staffId: string, caseId: string, message: string): Promise<Result<null>> {
    if (message.trim().length === 0) return err("Write a message before sending.");
    const applied = await resolutionsRepository.updateStatus(caseId, ["UNDER_REVIEW"], "AWAITING_CUSTOMER");
    if (!applied) return err("This case isn't under review.");
    const detail = await resolutionsRepository.findForAdmin(caseId);
    if (!detail) return err("Case not found.");

    const { messagingService } = await import("../messaging/service");
    await messagingService.staffStartOrContinueContextual({
      customerProfileId: (await prisma.resolutionCase.findUnique({ where: { id: caseId }, select: { customerProfileId: true } }))!.customerProfileId,
      staffUserId: staffId,
      contextType: "RESOLUTION_CASE",
      contextRefId: caseId,
      body: message,
    });

    await resolutionsRepository.createActivity(caseId, "clarification_requested", staffId);

    const context = await resolutionsRepository.findCaseContextForNotification(caseId);
    if (context) {
      await notificationsService.notify({
        recipientUserId: context.customerProfile.userId,
        type: "RESOLUTION_CLARIFICATION_NEEDED",
        title: "We need more information from you",
        body: `CrownSourceGlobal needs more information about case ${context.caseNumber}.`,
        targetUrl: notificationLinks.customerResolution(caseId),
        eventKey: `resolution-clarification-needed:${caseId}:${Date.now()}`,
        email: {
          to: context.customerProfile.user.email,
          subject: "We need more information from you",
          templateKey: "resolution-clarification-needed",
          templateData: { caseNumber: context.caseNumber, caseId },
        },
      });
    }
    return ok(null);
  },

  async requestVendorResponse(staffId: string, caseId: string, vendorId: string, message: string): Promise<Result<null>> {
    if (message.trim().length === 0) return err("Write a message before sending.");
    const applied = await resolutionsRepository.updateStatus(caseId, ["UNDER_REVIEW"], "AWAITING_VENDOR");
    if (!applied) return err("This case isn't under review.");

    const { messagingService } = await import("../messaging/service");
    await messagingService.staffStartOrContinueVendorContextual({ vendorId, staffUserId: staffId, contextResolutionCaseId: caseId, body: message });

    await resolutionsRepository.createActivity(caseId, "vendor_response_requested", staffId, { vendorId });

    const owner = await vendorsRepository.findOwnerUserIdAndEmail(vendorId);
    const caseRow = await resolutionsRepository.findStatusForUpdate(caseId);
    if (owner && caseRow) {
      await notificationsService.notify({
        recipientUserId: owner.userId,
        type: "RESOLUTION_VENDOR_RESPONSE_NEEDED",
        title: "CrownSourceGlobal needs your response",
        body: `CrownSourceGlobal needs your input on an order issue (case ${caseRow.caseNumber}).`,
        targetUrl: notificationLinks.vendorResolution(caseId),
        eventKey: `resolution-vendor-response-needed:${caseId}:${Date.now()}`,
        email: {
          to: owner.email,
          subject: "CrownSourceGlobal needs your response",
          templateKey: "resolution-vendor-response-needed",
          templateData: { caseNumber: caseRow.caseNumber, caseId },
        },
      });
    }
    return ok(null);
  },

  async resumeReview(staffId: string, caseId: string): Promise<Result<null>> {
    const applied = await resolutionsRepository.updateStatus(caseId, ["AWAITING_CUSTOMER", "AWAITING_VENDOR"], "UNDER_REVIEW");
    if (!applied) return err("This case isn't awaiting a reply.");
    await resolutionsRepository.createActivity(caseId, "review_resumed", staffId);
    return ok(null);
  },

  async rejectCase(staffId: string, caseId: string, customerSafeReason: string): Promise<Result<null>> {
    if (customerSafeReason.trim().length < 3) return err("Explain the decision for the customer.");
    const applied = await resolutionsRepository.updateStatus(caseId, ["OPEN", "UNDER_REVIEW", "AWAITING_CUSTOMER", "AWAITING_VENDOR"], "REJECTED", {
      customerSafeDecisionReason: customerSafeReason.trim(),
      resolvedAt: new Date(),
    });
    if (!applied) return err("This case can't be rejected right now.");
    await resolutionsRepository.createActivity(caseId, "case_rejected", staffId);
    return ok(null);
  },

  /** The core M9 decision engine — see modules/resolutions/repository.ts's approveResolutionTransactional for the full side-effect list. */
  async approveResolution(staffId: string, caseId: string, input: ApproveResolutionInput): Promise<Result<null>> {
    if (input.customerSafeDecisionReason.trim().length < 3) return err("Explain the decision for the customer.");
    if (input.items.length === 0) return err("Decide an outcome for at least one item.");

    const caseDetail = await resolutionsRepository.findForAdmin(caseId);
    if (!caseDetail) return err("Case not found.");
    if (caseDetail.status !== "UNDER_REVIEW") return err("This case isn't ready for a decision — move it to review first.");

    const existingItemIds = new Set(caseDetail.items.map((item) => item.id));
    if (input.items.some((item) => !existingItemIds.has(item.caseItemId))) {
      return err("One or more items don't belong to this case.");
    }

    const itemDecisions: { caseItemId: string; approvedResolution: string; approvedRefundAmount: number | null; replacementQuantity: number | null }[] = [];
    let itemsAmount = 0;
    const caseItemIdsToLink: string[] = [];
    let returnNeeded = false;
    const replacements: { originalOrderItemId: string; quantity: number }[] = [];
    const payoutHoldFulfilmentItemIds: string[] = [];

    for (const decision of input.items) {
      const caseItem = caseDetail.items.find((item) => item.id === decision.caseItemId)!;

      if (isRefundBearing(decision.approvedResolution)) {
        const amount = decision.approvedRefundAmount ?? 0;
        const alreadyApproved = await resolutionsRepository.sumApprovedRefundForOrderItem(caseItem.orderItemId);
        const lineTotal = caseItem.orderItem.unitPrice.toNumber() * caseItem.orderItem.quantity;
        const check = validateRefundAmount({ requestedAmount: amount, alreadyApprovedAmount: alreadyApproved, lineTotal });
        if (!check.ok) return err(`${caseItem.orderItem.description}: ${check.error}`);
        itemsAmount += amount;
        caseItemIdsToLink.push(decision.caseItemId);
        itemDecisions.push({ caseItemId: decision.caseItemId, approvedResolution: decision.approvedResolution, approvedRefundAmount: amount, replacementQuantity: null });
      } else if (isReplacement(decision.approvedResolution)) {
        const quantity = decision.replacementQuantity ?? 0;
        if (quantity <= 0 || quantity > caseItem.quantityAffected) {
          return err(`${caseItem.orderItem.description}: replacement quantity must be between 1 and ${caseItem.quantityAffected}.`);
        }
        replacements.push({ originalOrderItemId: caseItem.orderItemId, quantity });
        itemDecisions.push({ caseItemId: decision.caseItemId, approvedResolution: decision.approvedResolution, approvedRefundAmount: null, replacementQuantity: quantity });
      } else {
        itemDecisions.push({ caseItemId: decision.caseItemId, approvedResolution: decision.approvedResolution, approvedRefundAmount: null, replacementQuantity: null });
      }

      if (requiresReturn(decision.approvedResolution)) returnNeeded = true;
    }

    // payoutHold needs the raw fulfilmentItemId, which CaseItemView doesn't carry — resolve separately.
    if (input.responsibility === "VENDOR") {
      const rawItems = await prisma.resolutionCaseItem.findMany({ where: { id: { in: input.items.map((i) => i.caseItemId) } }, select: { id: true, fulfilmentItemId: true } });
      for (const decision of input.items) {
        if (!isRefundBearing(decision.approvedResolution) && !isReplacement(decision.approvedResolution)) continue;
        const raw = rawItems.find((r) => r.id === decision.caseItemId);
        if (raw?.fulfilmentItemId) payoutHoldFulfilmentItemIds.push(raw.fulfilmentItemId);
      }
    }

    let cancelFulfilment: { fulfilmentId: string; orderId: string; orderItemIds: string[] } | null = null;
    if (input.cancelFulfilmentId) {
      const fulfilment = await prisma.fulfilment.findUnique({
        where: { id: input.cancelFulfilmentId },
        select: { orderId: true, status: true, items: { select: { orderItemId: true } } },
      });
      if (!fulfilment) return err("Fulfilment not found.");
      if (!CANCELLABLE_FULFILMENT_STATUSES.includes(fulfilment.status)) {
        return err("This fulfilment has already progressed too far to be cancelled.");
      }
      cancelFulfilment = { fulfilmentId: input.cancelFulfilmentId, orderId: fulfilment.orderId, orderItemIds: fulfilment.items.map((i) => i.orderItemId) };
    }

    // A real refund executor (Paystack) needs the original Payment's own
    // reference to issue against — linked here, at approval time, rather
    // than left null as it always was before M10A.2 (nothing previously
    // read this link, so nothing ever populated it).
    const successfulPayment =
      itemsAmount > 0 ? await prisma.payment.findFirst({ where: { orderId: caseDetail.orderId, status: "SUCCEEDED" }, orderBy: { confirmedAt: "desc" }, select: { id: true } }) : null;

    const result = await resolutionsRepository.approveResolutionTransactional({
      caseId,
      fromStatuses: ["UNDER_REVIEW"],
      responsibility: input.responsibility,
      customerSafeDecisionReason: input.customerSafeDecisionReason.trim(),
      itemDecisions,
      refund: itemsAmount > 0 ? { itemsAmount, deliveryFeeAmount: 0, orderId: caseDetail.orderId, paymentId: successfulPayment?.id ?? null, caseItemIdsToLink } : null,
      returnNeeded,
      replacements,
      payoutHoldFulfilmentItemIds,
      payoutHoldReason: `Pending resolution case ${caseDetail.caseNumber}`,
      cancelFulfilment,
      actorUserId: staffId,
    });
    if (!result) return err("This case is no longer ready for a decision.");

    const context = await resolutionsRepository.findCaseContextForNotification(caseId);
    if (context) {
      await notificationsService.notify({
        recipientUserId: context.customerProfile.userId,
        type: "RESOLUTION_APPROVED",
        title: "Your case has been reviewed",
        body: `We've reviewed case ${context.caseNumber}: ${input.customerSafeDecisionReason.trim()}`,
        targetUrl: notificationLinks.customerResolution(caseId),
        eventKey: `resolution-approved:${caseId}`,
        email: {
          to: context.customerProfile.user.email,
          subject: "Your case has been reviewed",
          templateKey: "resolution-approved",
          templateData: { caseNumber: context.caseNumber, orderNumber: caseDetail.order.orderNumber, decisionReason: input.customerSafeDecisionReason.trim(), caseId },
        },
      });
      if (result.refundId) {
        await notificationsService.notify({
          recipientUserId: context.customerProfile.userId,
          type: "REFUND_APPROVED",
          title: "Your refund has been approved",
          body: `A refund has been approved for case ${context.caseNumber}.`,
          targetUrl: notificationLinks.customerResolution(caseId),
          eventKey: `refund-approved:${result.refundId}`,
          email: {
            to: context.customerProfile.user.email,
            subject: "Your refund has been approved",
            templateKey: "refund-approved",
            templateData: { caseNumber: context.caseNumber, amount: itemsAmount, currency: "GHS", caseId },
          },
        });
      }
      if (result.returnId) {
        await notificationsService.notify({
          recipientUserId: context.customerProfile.userId,
          type: "RETURN_APPROVED",
          title: "Your return has been approved",
          body: `A return has been approved for case ${context.caseNumber}.`,
          targetUrl: notificationLinks.customerResolution(caseId),
          eventKey: `return-approved:${result.returnId}`,
          email: {
            to: context.customerProfile.user.email,
            subject: "Your return has been approved",
            templateKey: "return-approved",
            templateData: { caseNumber: context.caseNumber, caseId },
          },
        });
      }
    }
    return ok(null);
  },

  async resolveCase(staffId: string, caseId: string): Promise<Result<null>> {
    const applied = await resolutionsRepository.updateStatus(caseId, ["RESOLUTION_APPROVED", "RESOLUTION_IN_PROGRESS"], "RESOLVED", { resolvedAt: new Date() });
    if (!applied) return err("This case isn't ready to be marked resolved.");
    await resolutionsRepository.createActivity(caseId, "case_resolved", staffId);

    const context = await resolutionsRepository.findCaseContextForNotification(caseId);
    const caseRow = await resolutionsRepository.findStatusForUpdate(caseId);
    if (context && caseRow) {
      await notificationsService.notify({
        recipientUserId: context.customerProfile.userId,
        type: "RESOLUTION_CASE_RESOLVED",
        title: "Your case is resolved",
        body: `Case ${context.caseNumber} is now resolved.`,
        targetUrl: notificationLinks.customerResolution(caseId),
        eventKey: `resolution-case-resolved:${caseId}`,
        email: {
          to: context.customerProfile.user.email,
          subject: "Your case is resolved",
          templateKey: "resolution-case-resolved",
          templateData: { caseNumber: context.caseNumber, orderNumber: context.order.orderNumber, caseId },
        },
      });
    }

    const vendorIds = await findAffectedVendorIds(caseId);
    for (const vendorId of vendorIds) {
      const owner = await vendorsRepository.findOwnerUserIdAndEmail(vendorId);
      if (!owner || !caseRow) continue;
      await notificationsService.notify({
        recipientUserId: owner.userId,
        type: "RESOLUTION_VENDOR_CASE_UPDATE",
        title: "Update on an order issue",
        body: `Case ${caseRow.caseNumber} affecting one of your orders is now resolved.`,
        targetUrl: notificationLinks.vendorResolution(caseId),
        eventKey: `resolution-vendor-case-update:${caseId}:${vendorId}`,
        email: {
          to: owner.email,
          subject: "Update on an order issue",
          templateKey: "resolution-vendor-case-update",
          templateData: { caseNumber: caseRow.caseNumber, caseId },
        },
      });
    }
    return ok(null);
  },

  async closeCase(staffId: string, caseId: string): Promise<Result<null>> {
    const applied = await resolutionsRepository.updateStatus(caseId, ["RESOLVED", "REJECTED"], "CLOSED", { closedAt: new Date() });
    if (!applied) return err("This case isn't ready to be closed.");
    await resolutionsRepository.createActivity(caseId, "case_closed", staffId);
    return ok(null);
  },

  async addInternalNote(staffId: string, caseId: string, note: string): Promise<Result<null>> {
    if (note.trim().length === 0) return err("Write a note before saving.");
    await resolutionsRepository.createActivity(caseId, "internal_note", staffId, { note: note.trim() });
    return ok(null);
  },

  // --- Refund execution --------------------------------------------------

  /**
   * Provider-aware by default: uses whichever provider actually processed
   * the ORIGINAL Payment linked to this refund
   * (`getRefundExecutorForPaymentProvider(refund.payment?.provider)`) —
   * MockRefundExecutor for MOCK, MoolreRefundExecutor for MOOLRE (always
   * fails closed — no documented refund API), PaystackRefundExecutor for
   * PAYSTACK (real, asynchronous). Production must never silently fall
   * back to a mock "success" for a real payment provider.
   *
   * `executorOverride` exists ONLY for tests that need to exercise a
   * specific executor's behavior deterministically, independent of
   * whatever PAYMENT_PROVIDER happens to be set in the local environment
   * running the test — reading ambient env state here directly once broke
   * the M9 refund test suite. Never pass this from a Server Action or any
   * other production call site.
   */
  async processRefund(staffId: string, refundId: string, outcome: MockRefundOutcome, executorOverride?: RefundExecutor): Promise<Result<null>> {
    const claimed = await resolutionsRepository.claimRefundForProcessing(refundId);
    if (!claimed) return err("This refund isn't ready to be processed.");

    const refund = await resolutionsRepository.findRefundForExecution(refundId);
    if (!refund) return err("Refund not found.");

    const executor = executorOverride ?? getRefundExecutorForPaymentProvider(refund.payment?.provider ?? null);
    const result = await executor.refund({
      outcome,
      amount: refund.amount.toNumber(),
      currency: refund.currency,
      paymentReference: refund.payment?.reference ?? null,
    });

    if (result.outcome === "COMPLETED") {
      await resolutionsRepository.markRefundCompleted(refundId, result.providerEventId);
      await resolutionsRepository.createActivity(refund.resolutionCaseId, "refund_completed", staffId, { refundId });
      await notifyRefundCompleted(refundId, refund.resolutionCaseId, refund.amount.toNumber(), refund.currency);
    } else if (result.outcome === "PENDING") {
      // Real async provider accepted the request — stays PROCESSING
      // (already its state from the claim above); never marked COMPLETED
      // merely because the create-refund call was accepted.
      if (result.providerEventId) {
        await resolutionsRepository.recordRefundProviderReference(refundId, result.providerEventId);
      }
      await resolutionsRepository.createActivity(refund.resolutionCaseId, "refund_processing", staffId, { refundId, providerEventId: result.providerEventId });
    } else {
      const failureReason = result.reasonSafe ?? "Simulated refund failure";
      await resolutionsRepository.markRefundFailed(refundId, failureReason);
      await resolutionsRepository.createActivity(refund.resolutionCaseId, "refund_failed", staffId, { refundId, failureReason });
      await notifyRefundFailed(refundId, refund.resolutionCaseId);
    }
    return ok(null);
  },

  /**
   * Independently re-fetches the refund's real status from Paystack —
   * never trusts a webhook body's embedded status alone, exactly the same
   * discipline as payment reconciliation. Used both by an explicit admin
   * action and by the Paystack refund webhook trigger (see
   * `reconcileRefundByProviderEventId` below). A refund only ever leaves
   * PROCESSING here, never elsewhere.
   */
  async reconcilePaystackRefund(refundId: string): Promise<Result<null>> {
    const refund = await resolutionsRepository.findRefundForReconciliation(refundId);
    if (!refund) return err("Refund not found.");
    if (!refund.providerEventId) return err("This refund has no provider reference to check yet.");
    if (refund.status !== "PROCESSING") return ok(null); // already resolved — idempotent no-op

    const result = await paystackClient.fetchRefund(refund.providerEventId);
    if (!result.ok) return err("Could not check refund status with Paystack right now.");

    if (result.data.data.status === "processed") {
      await resolutionsRepository.markRefundCompleted(refundId, refund.providerEventId);
      await resolutionsRepository.createActivity(refund.resolutionCaseId, "refund_completed", "system", { refundId });
      await notifyRefundCompleted(refundId, refund.resolutionCaseId, refund.amount.toNumber(), refund.currency);
    } else if (result.data.data.status === "failed") {
      await resolutionsRepository.markRefundFailed(refundId, "Paystack reported this refund as failed.");
      await resolutionsRepository.createActivity(refund.resolutionCaseId, "refund_failed", "system", { refundId });
      await notifyRefundFailed(refundId, refund.resolutionCaseId);
    }
    // "pending" — still processing, nothing to do yet.
    return ok(null);
  },

  /** Webhook-triggered variant of reconcilePaystackRefund — looks up the local Refund by Paystack's own refund id, then reuses the exact same independent-verification logic. */
  async reconcilePaystackRefundByProviderEventId(providerEventId: string): Promise<void> {
    const refund = await resolutionsRepository.findRefundByProviderEventId(providerEventId);
    if (!refund) return;
    await resolutionsService.reconcilePaystackRefund(refund.id);
  },

  // --- Return lifecycle ------------------------------------------------

  async recordReturnTransit(staffId: string, returnId: string, data: { method: string; trackingReference?: string; notes?: string }): Promise<Result<null>> {
    const applied = await resolutionsRepository.updateReturnStatus(returnId, ["APPROVED"], "IN_TRANSIT", data);
    if (!applied) return err("This return isn't ready to be marked in transit.");
    const ret = await resolutionsRepository.findReturnForUpdate(returnId);
    if (ret) await resolutionsRepository.createActivity(ret.resolutionCaseId, "return_in_transit", staffId);
    return ok(null);
  },

  async confirmReturnReceived(staffId: string, returnId: string): Promise<Result<null>> {
    const applied = await resolutionsRepository.updateReturnStatus(returnId, ["APPROVED", "IN_TRANSIT"], "RECEIVED", { receivedAt: new Date() });
    if (!applied) return err("This return isn't awaiting receipt.");
    const ret = await resolutionsRepository.findReturnForUpdate(returnId);
    if (ret) await resolutionsRepository.createActivity(ret.resolutionCaseId, "return_received", staffId);
    return ok(null);
  },

  async inspectReturn(staffId: string, returnId: string, outcome: "RESELLABLE" | "NOT_RESELLABLE", notes: string): Promise<Result<null>> {
    const applied = await resolutionsRepository.updateReturnStatus(returnId, ["RECEIVED"], "INSPECTED", { inspectedAt: new Date(), inspectionOutcome: outcome, notes });
    if (!applied) return err("This return isn't awaiting inspection.");
    const ret = await resolutionsRepository.findReturnForUpdate(returnId);
    if (!ret) return err("Return not found.");
    await resolutionsRepository.createActivity(ret.resolutionCaseId, "return_inspected", staffId, { outcome });

    if (outcome === "RESELLABLE") {
      const lines = await resolutionsRepository.findReturnLinesForRestock(ret.resolutionCaseId);
      const restockable = lines.filter((l): l is typeof l & { orderItem: { listingId: string } } => l.orderItem.listingId !== null);
      if (restockable.length > 0) {
        const restocked = await resolutionsRepository.restockFromReturnTransactional(
          returnId,
          restockable.map((l) => ({ listingId: l.orderItem.listingId, quantity: l.quantityAffected })),
        );
        if (restocked) await resolutionsRepository.createActivity(ret.resolutionCaseId, "inventory_restocked", staffId);
      }
    }
    return ok(null);
  },

  async completeReturn(staffId: string, returnId: string): Promise<Result<null>> {
    const applied = await resolutionsRepository.updateReturnStatus(returnId, ["INSPECTED"], "COMPLETED");
    if (!applied) return err("This return isn't ready to be completed.");
    const ret = await resolutionsRepository.findReturnForUpdate(returnId);
    if (ret) await resolutionsRepository.createActivity(ret.resolutionCaseId, "return_completed", staffId);
    return ok(null);
  },

  // --- Replacement fulfilment creation ------------------------------------

  async createReplacementFulfilment(staffId: string, replacementId: string): Promise<Result<{ fulfilmentId: string }>> {
    const replacement = await resolutionsRepository.findReplacementForCreation(replacementId);
    if (!replacement) return err("Replacement not found.");
    if (replacement.replacementOrderItemId) return err("A replacement fulfilment already exists for this item.");

    const vendorId = replacement.originalOrderItem.vendorId;
    if (!vendorId) return err("This item has no single vendor to create a replacement against.");

    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { country: true } });
    const origin = vendor?.country && vendor.country.trim().toLowerCase() !== "ghana" ? "INTERNATIONAL_INBOUND" : "DOMESTIC_COLLECTION";
    const defaultReceivingLocation = origin === "INTERNATIONAL_INBOUND" ? await resolutionsRepository.findDefaultReceivingLocationId() : null;

    try {
      const created = await resolutionsRepository.createReplacementFulfilmentTransactional({
        replacementId,
        orderId: replacement.originalOrderItem.orderId,
        vendorId,
        origin,
        listingId: replacement.originalOrderItem.listingId,
        description: replacement.originalOrderItem.description,
        quantity: replacement.quantity,
        defaultReceivingLocationId: defaultReceivingLocation?.id ?? null,
      });

      await resolutionsRepository.createActivity(replacement.resolutionCaseId, "replacement_created", staffId, { fulfilmentId: created.fulfilmentId });

      const context = await resolutionsRepository.findCaseContextForNotification(replacement.resolutionCaseId);
      if (context) {
        await notificationsService.notify({
          recipientUserId: context.customerProfile.userId,
          type: "REPLACEMENT_CREATED",
          title: "Your replacement is being prepared",
          body: `A replacement is being prepared for case ${context.caseNumber}.`,
          targetUrl: notificationLinks.customerOrder(replacement.originalOrderItem.orderId),
          eventKey: `replacement-created:${replacementId}`,
          email: {
            to: context.customerProfile.user.email,
            subject: "Your replacement is being prepared",
            templateKey: "replacement-created",
            templateData: { caseNumber: context.caseNumber, orderId: replacement.originalOrderItem.orderId },
          },
        });
      }
      const owner = await vendorsRepository.findOwnerUserIdAndEmail(vendorId);
      if (owner) {
        await notificationsService.notify({
          recipientUserId: owner.userId,
          type: "VENDOR_NEW_ORDER",
          title: "New order to prepare",
          body: `You have a replacement order to prepare: ${replacement.originalOrderItem.description}.`,
          targetUrl: notificationLinks.vendorOrder(created.fulfilmentId),
          eventKey: `vendor-new-order:${created.fulfilmentId}`,
          email: {
            to: owner.email,
            subject: "You have a new order to prepare",
            templateKey: "vendor-new-order",
            templateData: { orderNumber: "Replacement", fulfilmentId: created.fulfilmentId },
          },
        });
      }
      return ok({ fulfilmentId: created.fulfilmentId });
    } catch (error) {
      if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
        return err("Not enough stock available to create this replacement right now.");
      }
      console.error("Replacement fulfilment creation failed unexpectedly:", error);
      return err("Something went wrong creating the replacement.");
    }
  },

  // --- Evidence -----------------------------------------------------------

  async addAttachment(
    customerProfileId: string,
    uploadedByUserId: string,
    caseId: string,
    file: { filename: string; mimeType: string; buffer: Buffer },
  ): Promise<Result<null>> {
    const caseRow = await resolutionsRepository.findForCustomer(caseId, customerProfileId);
    if (!caseRow) return err("Case not found.");

    const validation = validateAttachment({ mimeType: file.mimeType, sizeBytes: file.buffer.length, buffer: file.buffer });
    if (!validation.ok) return err(validation.error);

    const storageKey = generateStorageKey("resolution-evidence");
    try {
      await storageProvider.putObject({ key: storageKey, buffer: file.buffer, contentType: file.mimeType });
    } catch (error) {
      console.error("Resolution evidence upload failed:", error);
      return err("Something went wrong uploading your file. Please try again.");
    }

    await resolutionsRepository.createAttachment(caseId, {
      storageKey,
      filename: sanitizeFilename(file.filename),
      mimeType: file.mimeType,
      sizeBytes: file.buffer.length,
      uploadedByUserId,
    });
    await resolutionsRepository.createActivity(caseId, "evidence_uploaded", uploadedByUserId);
    return ok(null);
  },

  async getAttachmentForDownload(attachmentId: string, access: { customerProfileId?: string; isStaff: boolean }) {
    const attachment = await resolutionsRepository.findAttachmentForAccess(attachmentId);
    if (!attachment) return null;
    const owned = access.customerProfileId && attachment.resolutionCase.customerProfileId === access.customerProfileId;
    if (!owned && !access.isStaff) return null;
    return attachment;
  },
};
