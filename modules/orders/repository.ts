import { prisma } from "../../lib/db";
import { paginationSkip } from "../../lib/pagination";
import type { DisplayStatusCase, DisplayStatusFulfilment } from "./display-status";

/** (M11.1) Shared across order list/detail — see modules/orders/display-status.ts for what this feeds. */
const displayStatusFulfilmentSelect = {
  id: true,
  status: true,
  vendor: { select: { companyName: true } },
  items: { select: { orderItemId: true } },
  shipments: { orderBy: { createdAt: "desc" as const }, take: 1, select: { status: true } },
} as const;

const displayStatusCaseSelect = {
  status: true,
  items: {
    select: {
      orderItemId: true,
      approvedResolution: true,
      refund: { select: { status: true } },
    },
  },
  returns: { select: { status: true } },
  replacements: {
    select: {
      originalOrderItemId: true,
      replacementOrderItem: { select: { fulfilmentItems: { take: 1, select: { fulfilment: { select: { status: true } } } } } },
    },
  },
} as const;

type RawDisplayStatusFulfilment = {
  id: string;
  status: string;
  vendor: { companyName: string };
  items: { orderItemId: string }[];
  shipments: { status: string }[];
};

type RawDisplayStatusCase = {
  status: string;
  items: { orderItemId: string; approvedResolution: string | null; refund: { status: string } | null }[];
  returns: { status: string }[];
  replacements: { originalOrderItemId: string; replacementOrderItem: { fulfilmentItems: { fulfilment: { status: string } }[] } | null }[];
};

function toDisplayStatusFulfilments(rows: RawDisplayStatusFulfilment[]): DisplayStatusFulfilment[] {
  return rows.map((f) => ({
    id: f.id,
    status: f.status,
    vendorName: f.vendor.companyName,
    shipmentStatus: f.shipments[0]?.status ?? null,
    orderItemIds: f.items.map((i) => i.orderItemId),
  }));
}

function toDisplayStatusCases(rows: RawDisplayStatusCase[]): DisplayStatusCase[] {
  return rows.map((c) => ({
    status: c.status,
    items: c.items.map((i) => ({ orderItemId: i.orderItemId, approvedResolution: i.approvedResolution, refundStatus: i.refund?.status ?? null })),
    returnStatuses: c.returns.map((r) => r.status),
    replacements: c.replacements.map((r) => ({
      originalOrderItemId: r.originalOrderItemId,
      replacementFulfilmentStatus: r.replacementOrderItem?.fulfilmentItems[0]?.fulfilment.status ?? null,
    })),
  }));
}

const orderItemSelect = {
  id: true,
  description: true,
  quantity: true,
  unitPrice: true,
  lineTotal: true,
  vendor: { select: { companyName: true, storefrontSlug: true } },
  // (M26) Current listing image only — OrderItem never snapshots one, so
  // this is best-effort ("Order imagery" §21): null once the listing is
  // gone, never a stand-in for the historical unitPrice/lineTotal snapshot.
  listing: { select: { images: true } },
} as const;

/** (M26) Order list rows need only enough of each item to derive a single list-row thumbnail and the item count — never the full detail select above. */
const orderListItemSelect = {
  quantity: true,
  listing: { select: { images: true } },
} as const;

const orderDetailSelect = {
  id: true,
  orderNumber: true,
  createdAt: true,
  status: true,
  paymentStatus: true,
  subtotal: true,
  total: true,
  currency: true,
  deliveryInfo: true,
  customerProfileId: true,
  items: { select: orderItemSelect, orderBy: { id: "asc" as const } },
  fulfilments: { select: displayStatusFulfilmentSelect },
  resolutionCases: { select: displayStatusCaseSelect },
  payments: {
    select: {
      status: true,
      provider: true,
      method: true,
      network: true,
      phoneMasked: true,
      cardBrand: true,
      cardLast4: true,
      reference: true,
      amount: true,
      currency: true,
      initiatedAt: true,
    },
    orderBy: { initiatedAt: "desc" as const },
    take: 1,
  },
} as const;

export const ordersRepository = {
  findByIdForCustomer(orderId: string, customerProfileId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, customerProfileId },
      select: orderDetailSelect,
    });
  },

  /** Ownership-scoped, minimal — used by the payment flow before mutating. */
  findOwnershipAndStatus(orderId: string, customerProfileId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, customerProfileId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        total: true,
        currency: true,
        orderNumber: true,
        customerProfile: { select: { user: { select: { email: true } } } },
      },
    });
  },

  /**
   * Orders still awaiting payment whose reservation has expired and that
   * have no successful Payment — candidates for the M10A abandoned-payment
   * sweep (docs/workflows/workflows.md Workflow F, previously documented
   * but never actually implemented since the old mock flow always resolved
   * synchronously and never left an order in this state).
   */
  findAbandonedPendingPayment(now: Date, limit: number) {
    return prisma.order.findMany({
      where: {
        status: "PENDING_PAYMENT",
        reservations: { some: { status: "HELD", expiresAt: { lt: now } } },
        payments: { none: { status: "SUCCEEDED" } },
      },
      select: { id: true },
      take: limit,
    });
  },

  /**
   * Guarded, idempotent: only fires from PENDING_PAYMENT, releases every
   * still-HELD reservation and restores availableQuantity — same
   * increment-on-release pattern as modules/resolutions'
   * restockFromReturnTransactional.
   */
  async releaseAbandonedOrderTransactional(orderId: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING_PAYMENT" },
        data: { status: "CANCELLED" },
      });
      if (claimed.count !== 1) return false;

      const reservations = await tx.inventoryReservation.findMany({
        where: { orderId, status: "HELD" },
        select: { id: true, listingId: true, quantity: true },
      });
      for (const reservation of reservations) {
        await tx.inventoryReservation.update({ where: { id: reservation.id }, data: { status: "RELEASED" } });
        await tx.vendorListing.update({
          where: { id: reservation.listingId },
          data: { availableQuantity: { increment: reservation.quantity } },
        });
      }
      return true;
    });
  },

  listForCustomer(customerProfileId: string) {
    return prisma.order.findMany({
      where: { customerProfileId },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        total: true,
        currency: true,
        items: { select: orderListItemSelect, orderBy: { id: "asc" as const } },
        fulfilments: { select: displayStatusFulfilmentSelect },
        resolutionCases: { select: displayStatusCaseSelect },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /** (M26) Paginated variant backing the mobile Orders list — same shape as listForCustomer's rows, skip/take + count. */
  async listForCustomerPaginated(customerProfileId: string, page: number, pageSize: number) {
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerProfileId },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          status: true,
          paymentStatus: true,
          total: true,
          currency: true,
          items: { select: orderListItemSelect, orderBy: { id: "asc" as const } },
          fulfilments: { select: displayStatusFulfilmentSelect },
          resolutionCases: { select: displayStatusCaseSelect },
        },
        orderBy: { createdAt: "desc" },
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.order.count({ where: { customerProfileId } }),
    ]);
    return { rows, total };
  },
};

export { toDisplayStatusFulfilments, toDisplayStatusCases };
