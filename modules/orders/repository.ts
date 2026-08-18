import { prisma } from "../../lib/db";

const orderItemSelect = {
  id: true,
  description: true,
  quantity: true,
  unitPrice: true,
  lineTotal: true,
  vendor: { select: { companyName: true, storefrontSlug: true } },
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
        items: { select: { quantity: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
