import { prisma } from "../../lib/db";
import type { DateRange } from "./types";

function rangeStart(range: DateRange, now: Date = new Date()): Date {
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const days = range === "7d" ? 7 : 30;
  start.setDate(start.getDate() - days);
  return start;
}

const SEARCH_TAKE = 6;

export const adminDashboardRepository = {
  rangeStart,

  // --- KPIs --------------------------------------------------------------

  countOrdersConfirmed(since: Date) {
    return prisma.order.count({
      where: { createdAt: { gte: since }, status: { in: ["CONFIRMED", "FULFILLING", "COMPLETED"] } },
    });
  },

  countShipmentsDelivered(since: Date) {
    return prisma.shipment.count({ where: { deliveredAt: { gte: since } } });
  },

  countSourcingRequestsSubmitted(since: Date) {
    return prisma.customSourcingRequest.count({ where: { submittedAt: { gte: since } } });
  },

  countVendorApplicationsReceived(since: Date) {
    return prisma.vendorApplication.count({ where: { submittedAt: { gte: since } } });
  },

  countQuotesIssued(since: Date) {
    return prisma.quotation.count({ where: { issuedAt: { gte: since } } });
  },

  countActiveVendors() {
    return prisma.vendor.count({ where: { verificationStatus: "APPROVED" } });
  },

  countActiveListings() {
    return prisma.vendorListing.count({ where: { listingStatus: "ACTIVE" } });
  },

  countFulfilmentsInProgress() {
    return prisma.fulfilment.count({
      where: { status: { in: ["PENDING", "ACCEPTED", "PREPARING", "READY", "DISPATCHED", "EXCEPTION"] } },
    });
  },

  countReadyForCollection() {
    return prisma.fulfilment.count({ where: { status: "READY", origin: "DOMESTIC_COLLECTION" } });
  },

  countOpenDeliveryIssues() {
    return prisma.fulfilmentIssue.count({ where: { status: "OPEN" } });
  },

  // --- M9 resolution counts ------------------------------------------------

  countOpenResolutionCases() {
    return prisma.resolutionCase.count({ where: { status: { notIn: ["RESOLVED", "REJECTED", "CLOSED"] } } });
  },

  countResolutionCasesByStatus(status: "AWAITING_CUSTOMER" | "AWAITING_VENDOR") {
    return prisma.resolutionCase.count({ where: { status } });
  },

  countReturnsAwaitingInspection() {
    return prisma.return.count({ where: { status: "RECEIVED" } });
  },

  countRefundsPending() {
    return prisma.refund.count({ where: { status: { in: ["PENDING_APPROVAL", "APPROVED", "PROCESSING"] } } });
  },

  countReplacementFulfilmentsInProgress() {
    return prisma.replacement.count({ where: { replacementOrderItem: { fulfilmentItems: { some: { fulfilment: { status: { notIn: ["DELIVERED", "COMPLETED", "CANCELLED"] } } } } } } });
  },

  // --- M9 resolution attention sources --------------------------------------

  findOpenResolutionCasesForAttention() {
    return prisma.resolutionCase.findMany({
      where: { status: { notIn: ["RESOLVED", "REJECTED", "CLOSED"] } },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        issueType: true,
        assignedStaffId: true,
        updatedAt: true,
        order: { select: { orderNumber: true } },
      },
    });
  },

  findReturnsAwaitingInspectionForAttention() {
    return prisma.return.findMany({
      where: { status: "RECEIVED" },
      select: { id: true, updatedAt: true, resolutionCase: { select: { id: true, caseNumber: true, order: { select: { orderNumber: true } } } } },
    });
  },

  findFailedRefundsForAttention() {
    return prisma.refund.findMany({
      where: { status: "FAILED" },
      select: { id: true, updatedAt: true, resolutionCase: { select: { id: true, caseNumber: true, order: { select: { orderNumber: true } } } } },
    });
  },

  searchResolutionCases(q: string) {
    return prisma.resolutionCase.findMany({
      where: { caseNumber: { contains: q, mode: "insensitive" } },
      select: { id: true, caseNumber: true, status: true, order: { select: { orderNumber: true } } },
      take: SEARCH_TAKE,
    });
  },

  // --- Recent activity (secondary, read-only union of existing timestamps) ---

  async recentActivity() {
    const [approvedApplications, deliveredShipments, sourcingActivity] = await Promise.all([
      prisma.vendorApplication.findMany({
        where: { status: "APPROVED" },
        select: { id: true, displayName: true, reviewedAt: true },
        orderBy: { reviewedAt: "desc" },
        take: 5,
      }),
      prisma.shipment.findMany({
        where: { status: "DELIVERED" },
        select: { id: true, deliveredAt: true, fulfilment: { select: { id: true, order: { select: { orderNumber: true } } } } },
        orderBy: { deliveredAt: "desc" },
        take: 5,
      }),
      prisma.sourcingRequestActivity.findMany({
        where: { type: { in: ["quote_issued", "quote_accepted", "unable_to_source"] } },
        select: { id: true, type: true, createdAt: true, sourcingRequestId: true, sourcingRequest: { select: { requestNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);
    return { approvedApplications, deliveredShipments, sourcingActivity };
  },

  // --- Search (bounded, parallel, exact/prefix/ILIKE — no dedicated search infra) ---

  searchOrders(q: string) {
    return prisma.order.findMany({
      where: { orderNumber: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerProfile: { select: { displayName: true } },
        fulfilments: { select: { id: true }, take: 1, orderBy: { createdAt: "asc" } },
      },
      take: SEARCH_TAKE,
    });
  },

  /** M10A — matches on CrownSourceGlobal's own reference, the provider's reference, or the parent Order number. Safe summary fields only. */
  searchPayments(q: string) {
    return prisma.payment.findMany({
      where: {
        OR: [
          { reference: { contains: q, mode: "insensitive" } },
          { providerEventId: { contains: q, mode: "insensitive" } },
          { order: { orderNumber: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, reference: true, status: true, order: { select: { orderNumber: true } } },
      take: SEARCH_TAKE,
    });
  },

  findPaymentExceptions() {
    return prisma.payment.findMany({
      where: { exceptionReason: { not: null } },
      select: { id: true, reference: true, exceptionReason: true, initiatedAt: true, order: { select: { orderNumber: true } } },
      orderBy: { initiatedAt: "asc" },
    });
  },

  searchQuotations(q: string) {
    return prisma.quotation.findMany({
      where: { reference: { contains: q, mode: "insensitive" } },
      select: { id: true, reference: true, status: true, customerProfile: { select: { displayName: true } } },
      take: SEARCH_TAKE,
    });
  },

  searchSourcingRequests(q: string) {
    return prisma.customSourcingRequest.findMany({
      where: { OR: [{ requestNumber: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] },
      select: { id: true, requestNumber: true, title: true, status: true },
      take: SEARCH_TAKE,
    });
  },

  searchVendors(q: string) {
    return prisma.vendor.findMany({
      where: { companyName: { contains: q, mode: "insensitive" } },
      select: { id: true, companyName: true, verificationStatus: true, storefrontSlug: true },
      take: SEARCH_TAKE,
    });
  },

  /** Safe summary only — never selects raw delivery/contact detail beyond name+email, matching what admin already sees elsewhere (e.g. vendor-application review). */
  searchCustomers(q: string) {
    return prisma.customerProfile.findMany({
      where: { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }] },
      select: { id: true, displayName: true, user: { select: { email: true } } },
      take: SEARCH_TAKE,
    });
  },

  /** No dedicated customer-360 page exists (deliberately, per M8 scope) — the most recent quotation or order is the practical "open" target for a matched customer. */
  async findRecentCustomerTarget(customerProfileId: string): Promise<{ label: string; targetUrl: string } | null> {
    const quotation = await prisma.quotation.findFirst({
      where: { customerProfileId },
      select: { id: true, reference: true },
      orderBy: { issuedAt: "desc" },
    });
    if (quotation) return { label: `Quote ${quotation.reference}`, targetUrl: `/admin/quotations/${quotation.id}` };

    const order = await prisma.order.findFirst({
      where: { customerProfileId },
      select: { orderNumber: true, fulfilments: { select: { id: true }, take: 1, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    if (order && order.fulfilments[0]) return { label: `Order ${order.orderNumber}`, targetUrl: `/admin/operations/${order.fulfilments[0].id}` };
    return null;
  },

  searchListings(q: string) {
    return prisma.vendorListing.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, approvalStatus: true, vendor: { select: { companyName: true } } },
      take: SEARCH_TAKE,
    });
  },

  searchShipments(q: string) {
    return prisma.shipment.findMany({
      where: { trackingReference: { contains: q, mode: "insensitive" } },
      select: { id: true, trackingReference: true, status: true, fulfilmentId: true, fulfilment: { select: { order: { select: { orderNumber: true } } } } },
      take: SEARCH_TAKE,
    });
  },
};
