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
  payments: { select: { status: true }, orderBy: { initiatedAt: "desc" as const }, take: 1 },
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
      select: { id: true, status: true, paymentStatus: true, total: true, currency: true, orderNumber: true },
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
