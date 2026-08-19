import { prisma } from "../../lib/db";
import { vendorFinanceRepository } from "../vendor-finance/repository";
import { paginationSkip } from "../../lib/pagination";

const itemsInclude = { items: { include: { orderItem: { select: { description: true } } } } } as const;

const shipmentInclude = {
  shipments: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    include: {
      receivingLocation: {
        select: { name: true, addressLine1: true, city: true, region: true, country: true, contactName: true, contactPhone: true },
      },
    },
  },
} as const;

const openIssueInclude = {
  issues: { where: { status: "OPEN" as const }, orderBy: { createdAt: "desc" as const }, take: 1 },
} as const;

export const fulfilmentRepository = {
  async findNotificationContext(fulfilmentId: string) {
    const fulfilment = await prisma.fulfilment.findUnique({
      where: { id: fulfilmentId },
      select: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerProfile: { select: { userId: true, user: { select: { email: true } } } },
          },
        },
        vendor: { select: { id: true } },
      },
    });
    if (!fulfilment) return null;
    return {
      orderId: fulfilment.order.id,
      orderNumber: fulfilment.order.orderNumber,
      customerUserId: fulfilment.order.customerProfile.userId,
      customerEmail: fulfilment.order.customerProfile.user.email,
      vendorId: fulfilment.vendor.id,
    };
  },


  // --- Vendor ------------------------------------------------------------

  findForVendor(vendorId: string, status?: string) {
    return prisma.fulfilment.findMany({
      where: { vendorId, ...(status ? { status: status as never } : {}) },
      select: {
        id: true,
        status: true,
        origin: true,
        createdAt: true,
        order: { select: { orderNumber: true } },
        items: { select: { quantity: true } },
        issues: { where: { status: "OPEN" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * (M11.1) Paginated variant for the vendor portal orders list page —
   * distinct from findForVendor, which app/vendor/portal/page.tsx (the
   * dashboard) still needs unbounded to compute its "new orders"/"issues"
   * stat-card counts across every fulfilment, not just one page's worth.
   */
  async findForVendorPaginated(vendorId: string, status: string | undefined, page: number, pageSize: number) {
    const where = { vendorId, ...(status ? { status: status as never } : {}) };
    const [rows, total] = await Promise.all([
      prisma.fulfilment.findMany({
        where,
        select: {
          id: true,
          status: true,
          origin: true,
          createdAt: true,
          order: { select: { orderNumber: true } },
          items: { select: { quantity: true } },
          issues: { where: { status: "OPEN" }, select: { id: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.fulfilment.count({ where }),
    ]);
    return { rows, total };
  },

  findDetailForVendor(vendorId: string, fulfilmentId: string) {
    return prisma.fulfilment.findFirst({
      where: { id: fulfilmentId, vendorId },
      include: {
        order: { select: { orderNumber: true } },
        vendor: { select: { leadTimeDaysDefault: true } },
        ...itemsInclude,
        ...shipmentInclude,
        ...openIssueInclude,
      },
    });
  },

  /** Ownership + state-transition scoped — only succeeds from an allowed current status. */
  async updateStatusForVendor(vendorId: string, fulfilmentId: string, fromStatuses: string[], toStatus: string) {
    const result = await prisma.fulfilment.updateMany({
      where: { id: fulfilmentId, vendorId, status: { in: fromStatuses as never[] } },
      data: { status: toStatus as never },
    });
    return result.count > 0;
  },

  async createIssueForVendor(
    vendorId: string,
    fulfilmentId: string,
    reportedByUserId: string,
    category: string,
    description: string,
  ) {
    const fulfilment = await prisma.fulfilment.findFirst({
      where: { id: fulfilmentId, vendorId, status: { in: ["PENDING", "PREPARING", "READY"] } },
      select: { id: true },
    });
    if (!fulfilment) return null;
    return prisma.$transaction(async (tx) => {
      const issue = await tx.fulfilmentIssue.create({
        data: { fulfilmentId, reportedByUserId, category, description },
      });
      await tx.fulfilment.update({ where: { id: fulfilmentId }, data: { status: "EXCEPTION" } });
      return issue;
    });
  },

  /** International only — vendor records their own outbound shipment to the assigned receiving location. */
  async recordVendorShipment(
    vendorId: string,
    fulfilmentId: string,
    data: { carrier: string; trackingReference: string; shippedAt: Date; expectedArrivalAt: Date | null },
  ) {
    const fulfilment = await prisma.fulfilment.findFirst({
      where: { id: fulfilmentId, vendorId, status: "READY", origin: "INTERNATIONAL_INBOUND" },
      include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!fulfilment) return null;
    const shipment = fulfilment.shipments[0];
    if (!shipment || !shipment.receivingLocationId) return null; // no destination assigned yet — cannot ship

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { carrier: data.carrier, trackingReference: data.trackingReference, shippedAt: data.shippedAt, expectedArrivalAt: data.expectedArrivalAt },
      });
      await tx.fulfilment.update({ where: { id: fulfilmentId }, data: { status: "DISPATCHED" } });
    });
    return true;
  },

  // --- Admin ---------------------------------------------------------------

  findForAdmin(filter: { status?: string; origin?: string }) {
    return prisma.fulfilment.findMany({
      where: {
        ...(filter.status ? { status: filter.status as never } : {}),
        ...(filter.origin ? { origin: filter.origin as never } : {}),
      },
      select: {
        id: true,
        status: true,
        origin: true,
        createdAt: true,
        updatedAt: true,
        vendor: { select: { id: true, companyName: true, leadTimeDaysDefault: true } },
        order: { select: { orderNumber: true } },
        items: { select: { id: true } },
        issues: { where: { status: "OPEN" }, select: { id: true } },
        shipments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, shippedAt: true, receivedAt: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  /**
   * (M11.1) Paginated variant of findForAdmin, for the admin Operations
   * queue page. findForAdmin itself stays unbounded — it's also used by
   * admin-dashboard's fulfilmentAttention(), which needs the full set to
   * scan for overdue/exception items, not one page of it.
   */
  async findForAdminPaginated(filter: { status?: string; origin?: string }, page: number, pageSize: number) {
    const where = {
      ...(filter.status ? { status: filter.status as never } : {}),
      ...(filter.origin ? { origin: filter.origin as never } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.fulfilment.findMany({
        where,
        select: {
          id: true,
          status: true,
          origin: true,
          createdAt: true,
          updatedAt: true,
          vendor: { select: { id: true, companyName: true, leadTimeDaysDefault: true } },
          order: { select: { orderNumber: true } },
          items: { select: { id: true } },
          issues: { where: { status: "OPEN" }, select: { id: true } },
          shipments: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true, shippedAt: true, receivedAt: true },
          },
        },
        // Newest-first (M11.1 corrective pass) — a newly created fulfilment
        // must appear on page 1, not buried on the last page. `id: "desc"`
        // is a tie-breaker for rows created in the same millisecond, so
        // page boundaries stay stable/deterministic across requests.
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.fulfilment.count({ where }),
    ]);
    return { rows, total };
  },

  findDetailForAdmin(fulfilmentId: string) {
    return prisma.fulfilment.findUnique({
      where: { id: fulfilmentId },
      include: {
        order: { select: { orderNumber: true, deliveryInfo: true } },
        vendor: {
          select: {
            id: true,
            companyName: true,
            leadTimeDaysDefault: true,
            pickupAddressLine1: true,
            pickupContactName: true,
            pickupContactPhone: true,
            pickupHours: true,
            pickupNotes: true,
          },
        },
        ...itemsInclude,
        ...shipmentInclude,
        ...openIssueInclude,
      },
    });
  },

  async assignReceivingLocation(fulfilmentId: string, receivingLocationId: string) {
    const shipment = await prisma.shipment.findFirst({ where: { fulfilmentId }, orderBy: { createdAt: "desc" } });
    if (!shipment) return false;
    await prisma.shipment.update({ where: { id: shipment.id }, data: { receivingLocationId } });
    return true;
  },

  /**
   * (M11.1) Domestic-collection single-action confirm — replaces the old
   * two-step "Save collection details" then separate "Confirm collected."
   * Records the carrier/tracking/notes AND performs the CREATED -> COLLECTED
   * (-> Fulfilment DISPATCHED) transition atomically, exactly like
   * confirmCollectedOrReceived's guard (only from shipment status CREATED),
   * so an admin can never end up in a state where details were "saved" but
   * the order wasn't actually marked collected, or vice versa.
   */
  async confirmCollectionTransactional(
    fulfilmentId: string,
    actorUserId: string,
    data: { carrier?: string; trackingReference?: string; notes?: string },
  ) {
    const fulfilment = await prisma.fulfilment.findUnique({
      where: { id: fulfilmentId },
      include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const shipment = fulfilment?.shipments[0];
    if (!fulfilment || !shipment || shipment.status !== "CREATED") return false;

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          carrier: data.carrier,
          trackingReference: data.trackingReference,
          collectionNotes: data.notes,
          status: "COLLECTED",
          collectedAt: now,
          collectedByUserId: actorUserId,
        },
      });
      if (fulfilment.origin === "DOMESTIC_COLLECTION") {
        await tx.fulfilment.update({ where: { id: fulfilmentId }, data: { status: "DISPATCHED" } });
      }
    });
    return true;
  },

  /** Admin confirms physical possession — domestic pickup OR international receipt, both land here. */
  async confirmCollectedOrReceived(
    fulfilmentId: string,
    actorUserId: string,
    receivingLocationId: string | null,
  ) {
    const fulfilment = await prisma.fulfilment.findUnique({
      where: { id: fulfilmentId },
      include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const shipment = fulfilment?.shipments[0];
    if (!fulfilment || !shipment || shipment.status !== "CREATED") return false;

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipment.id },
        data:
          fulfilment.origin === "INTERNATIONAL_INBOUND"
            ? { status: "COLLECTED", receivedAt: now, receivedByUserId: actorUserId, receivingLocationId: receivingLocationId ?? shipment.receivingLocationId }
            : { status: "COLLECTED", collectedAt: now, collectedByUserId: actorUserId },
      });
      if (fulfilment.origin === "DOMESTIC_COLLECTION") {
        await tx.fulfilment.update({ where: { id: fulfilmentId }, data: { status: "DISPATCHED" } });
      }
    });
    return true;
  },

  async progressShipment(
    fulfilmentId: string,
    fromStatuses: string[],
    toStatus: string,
    extra: Record<string, unknown> = {},
  ) {
    const shipment = await prisma.shipment.findFirst({ where: { fulfilmentId }, orderBy: { createdAt: "desc" } });
    if (!shipment || !fromStatuses.includes(shipment.status)) return false;

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({ where: { id: shipment.id }, data: { status: toStatus as never, ...extra } });
      if (toStatus === "DELIVERED") {
        await tx.fulfilment.update({ where: { id: fulfilmentId }, data: { status: "DELIVERED" } });
        // M11.1 — event-driven PENDING -> WAITING_PERIOD, in the same
        // transaction as the delivery itself (never a separate, later step
        // the sweep would need to reconstruct).
        const deliveredAt = (extra as { deliveredAt?: Date }).deliveredAt ?? new Date();
        await vendorFinanceRepository.startWaitingPeriodForFulfilmentTx(tx, fulfilmentId, deliveredAt);
      }
      if (toStatus === "EXCEPTION" || toStatus === "DELIVERY_FAILED") {
        await tx.fulfilment.update({ where: { id: fulfilmentId }, data: { status: "EXCEPTION" } });
      }
    });
    return true;
  },

  async resolveIssue(issueId: string, resolvedByUserId: string, resolutionNotes: string) {
    const issue = await prisma.fulfilmentIssue.findUnique({ where: { id: issueId } });
    if (!issue || issue.status !== "OPEN") return null;
    await prisma.$transaction(async (tx) => {
      await tx.fulfilmentIssue.update({
        where: { id: issueId },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedByUserId, resolutionNotes },
      });
      await tx.fulfilment.update({ where: { id: issue.fulfilmentId }, data: { status: "PREPARING" } });
    });
    return { fulfilmentId: issue.fulfilmentId };
  },

  // --- Customer ------------------------------------------------------------

  findForCustomerOrder(orderId: string, customerProfileId: string) {
    return prisma.fulfilment.findMany({
      where: { orderId, order: { customerProfileId } },
      select: {
        id: true,
        status: true,
        origin: true,
        vendor: { select: { companyName: true } },
        ...itemsInclude,
        shipments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, deliveredAt: true, customerConfirmedReceiptAt: true } },
        issues: { where: { status: "OPEN" }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async confirmCustomerReceipt(fulfilmentId: string, orderId: string, customerProfileId: string) {
    const fulfilment = await prisma.fulfilment.findFirst({
      where: { id: fulfilmentId, orderId, order: { customerProfileId } },
      include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const shipment = fulfilment?.shipments[0];
    if (!fulfilment || !shipment) return false;
    await prisma.shipment.update({ where: { id: shipment.id }, data: { customerConfirmedReceiptAt: new Date() } });
    return true;
  },
};
