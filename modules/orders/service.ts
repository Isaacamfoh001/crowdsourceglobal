import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { cartRepository } from "../cart/repository";
import { pricingService } from "../pricing/service";
import { resolveUnitPrice } from "../pricing/resolveUnitPrice";
import { generateOrderNumber } from "../../lib/order-number";
import { ordersRepository } from "./repository";
import { ok, err, type Result } from "../../lib/result";
import type { DeliveryInfo, OrderDetailView, OrderSummaryView } from "./types";

const RESERVATION_TTL_MINUTES = 15;

/** Thrown inside the checkout transaction to trigger a clean rollback with a customer-facing message. */
class CheckoutValidationError extends Error {}

type PreparedOrderItem = {
  listingId: string;
  vendorId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vendorPayableBasis: number;
  lineTotal: number;
};

async function runCheckoutTransaction(
  customerProfileId: string,
  cartId: string,
  cartItems: { listingId: string; quantity: number }[],
  deliveryInfo: DeliveryInfo,
): Promise<string> {
  const listingIds = cartItems.map((item) => item.listingId);
  const tiersByListing = await pricingService.getBulkTiersForListings(listingIds);

  return prisma.$transaction(async (tx) => {
    const preparedItems: PreparedOrderItem[] = [];
    let subtotal = 0;

    for (const item of cartItems) {
      // Never trust the cart snapshot for price/availability — re-read fresh inside the transaction.
      const listing = await tx.vendorListing.findUnique({
        where: { id: item.listingId },
        select: {
          id: true,
          title: true,
          basePrice: true,
          moq: true,
          maxOq: true,
          approvalStatus: true,
          listingStatus: true,
          vendorId: true,
          vendorCostRule: { select: { vendorSupplyCost: true } },
        },
      });

      if (!listing || listing.approvalStatus !== "APPROVED" || listing.listingStatus !== "ACTIVE") {
        throw new CheckoutValidationError(
          `An item in your cart is no longer available. Please review your cart.`,
        );
      }
      if (item.quantity < listing.moq) {
        throw new CheckoutValidationError(
          `${listing.title}: minimum order quantity is ${listing.moq}.`,
        );
      }
      if (listing.maxOq && item.quantity > listing.maxOq) {
        throw new CheckoutValidationError(
          `${listing.title}: maximum order quantity is ${listing.maxOq}.`,
        );
      }

      // Atomic check-and-decrement — the reservation mechanism from
      // docs/workflows/workflows.md Workflow G, inside this same transaction.
      const decremented = await tx.vendorListing.updateMany({
        where: { id: listing.id, availableQuantity: { gte: item.quantity } },
        data: { availableQuantity: { decrement: item.quantity } },
      });
      if (decremented.count !== 1) {
        throw new CheckoutValidationError(
          `Only a limited quantity of ${listing.title} is left. Please update your cart.`,
        );
      }

      const tiers = tiersByListing.get(item.listingId) ?? [];
      const unitPrice = resolveUnitPrice(listing.basePrice.toNumber(), tiers, item.quantity);
      const lineTotal = unitPrice * item.quantity;
      // Fallback to unitPrice (zero assumed margin) if a listing somehow has
      // no VendorCostRule — defensive only, seed data always creates one.
      const vendorSupplyCost = listing.vendorCostRule?.vendorSupplyCost.toNumber() ?? unitPrice;
      const vendorPayableBasis = vendorSupplyCost * item.quantity;
      subtotal += lineTotal;

      preparedItems.push({
        listingId: listing.id,
        vendorId: listing.vendorId,
        description: listing.title,
        quantity: item.quantity,
        unitPrice,
        vendorPayableBasis,
        lineTotal,
      });
    }

    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerProfileId,
        subtotal,
        total: subtotal, // no tax/delivery fee model approved yet — see PROJECT.md/§10 of this milestone's brief
        deliveryInfo: deliveryInfo as unknown as Prisma.InputJsonValue,
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
      },
    });

    await tx.orderItem.createMany({
      data: preparedItems.map((item) => ({ ...item, orderId: order.id })),
    });

    await tx.inventoryReservation.createMany({
      data: preparedItems.map((item) => ({
        listingId: item.listingId,
        orderId: order.id,
        quantity: item.quantity,
        status: "HELD" as const,
        expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60_000),
      })),
    });

    await tx.cart.update({ where: { id: cartId }, data: { status: "CONVERTED" } });

    return order.id;
  });
}

export const ordersService = {
  async createOrderFromCart(
    customerProfileId: string,
    deliveryInfo: DeliveryInfo,
  ): Promise<Result<{ orderId: string }>> {
    const cart = await cartRepository.findActiveCartByCustomerId(customerProfileId);
    if (!cart || cart.items.length === 0) {
      return err("Your cart is empty.");
    }

    const cartItems = cart.items.map((item) => ({ listingId: item.listingId, quantity: item.quantity }));

    // orderNumber collisions are astronomically unlikely (5 chars from a
    // 32-symbol alphabet) but retried defensively rather than assumed away.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const orderId = await runCheckoutTransaction(customerProfileId, cart.id, cartItems, deliveryInfo);
        return ok({ orderId });
      } catch (error) {
        if (error instanceof CheckoutValidationError) {
          return err(error.message);
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt < 2
        ) {
          continue; // orderNumber collision — retry with a freshly generated one
        }
        console.error("Checkout failed unexpectedly:", error);
        return err("Something went wrong creating your order. Please try again.");
      }
    }

    return err("Something went wrong creating your order. Please try again.");
  },

  /**
   * Payment succeeded → Order CONFIRMED, reservations committed, Fulfilments
   * fan out per distinct vendor on the order (Workflow B). Idempotent via
   * `fulfilmentsCreatedAt` — see docs/domain/state-machines.md's Fulfilment
   * idempotency note (creation is keyed to "has this confirmation already
   * produced Fulfilments", not vendor-scoped uniqueness).
   */
  /**
   * Returns the vendorIds that received a NEW Fulfilment this call (empty
   * on an idempotent no-op re-confirmation) — the caller uses this to
   * dispatch "you have a new order" notifications exactly once per real
   * confirmation, never on a repeat/duplicate webhook-equivalent call.
   */
  async confirmOrderPayment(orderId: string): Promise<{ newVendorIds: string[] }> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, fulfilmentsCreatedAt: true, items: true },
      });
      if (!order || order.status === "CONFIRMED") {
        return { newVendorIds: [] }; // already confirmed — nothing to do (idempotent no-op)
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: "CONFIRMED", paymentStatus: "PAID" },
      });

      await tx.inventoryReservation.updateMany({
        where: { orderId, status: "HELD" },
        data: { status: "COMMITTED" },
      });

      if (order.fulfilmentsCreatedAt) {
        return { newVendorIds: [] }; // Fulfilments already created for this confirmation
      }

      const itemsByVendor = new Map<string, typeof order.items>();
      for (const item of order.items) {
        if (!item.vendorId) continue; // custom-sourcing aggregate lines (not used in M2) have no single vendor
        const group = itemsByVendor.get(item.vendorId) ?? [];
        group.push(item);
        itemsByVendor.set(item.vendorId, group);
      }

      const defaultReceivingLocation = await tx.receivingLocation.findFirst({
        where: { active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      for (const [vendorId, items] of itemsByVendor) {
        const vendor = await tx.vendor.findUnique({ where: { id: vendorId }, select: { country: true } });
        // Snapshotted at creation time, per the same principle as OrderItem
        // pricing — never re-derived from live vendor data afterward.
        const origin = vendor?.country && vendor.country.trim().toLowerCase() !== "ghana"
          ? "INTERNATIONAL_INBOUND"
          : "DOMESTIC_COLLECTION";

        const fulfilment = await tx.fulfilment.create({ data: { orderId, vendorId, origin } });
        await tx.fulfilmentItem.createMany({
          data: items.map((item) => ({
            fulfilmentId: fulfilment.id,
            orderItemId: item.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vendorPayableBasis: item.vendorPayableBasis,
          })),
        });
        await tx.shipment.create({
          data: {
            fulfilmentId: fulfilment.id,
            receivingLocationId: origin === "INTERNATIONAL_INBOUND" ? defaultReceivingLocation?.id : undefined,
          },
        });
      }

      await tx.order.update({ where: { id: orderId }, data: { fulfilmentsCreatedAt: new Date() } });
      return { newVendorIds: [...itemsByVendor.keys()] };
    });
  },

  async getOrderDetail(orderId: string, customerProfileId: string): Promise<OrderDetailView | null> {
    const order = await ordersRepository.findByIdForCustomer(orderId, customerProfileId);
    if (!order) {
      return null;
    }

    const groupsByVendor = new Map<string, OrderDetailView["vendorGroups"][number]>();
    for (const item of order.items) {
      const vendorName = item.vendor?.companyName ?? "CrownSourceGlobal";
      const existing = groupsByVendor.get(vendorName);
      const view = {
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
        vendor: item.vendor,
      };
      if (existing) {
        existing.items.push(view);
        existing.subtotal += view.lineTotal;
      } else {
        groupsByVendor.set(vendorName, { vendorName, items: [view], subtotal: view.lineTotal });
      }
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal.toNumber(),
      total: order.total.toNumber(),
      currency: order.currency,
      deliveryInfo: order.deliveryInfo as unknown as DeliveryInfo,
      vendorGroups: [...groupsByVendor.values()],
      latestPaymentStatus: order.payments[0]?.status ?? null,
    };
  },

  async listOrders(customerProfileId: string): Promise<OrderSummaryView[]> {
    const orders = await ordersRepository.listForCustomer(customerProfileId);
    return orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total.toNumber(),
      currency: order.currency,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    }));
  },
};
