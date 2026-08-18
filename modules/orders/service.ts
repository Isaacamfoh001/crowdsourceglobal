import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { cartRepository } from "../cart/repository";
import { pricingService } from "../pricing/service";
import { resolveUnitPrice } from "../pricing/resolveUnitPrice";
import { generateOrderNumber } from "../../lib/order-number";
import { quotationRepository } from "../quotation/repository";
import { ordersRepository } from "./repository";
import { ok, err, type Result } from "../../lib/result";
import type { DeliveryInfo, OrderDetailView, OrderSummaryView } from "./types";

const RESERVATION_TTL_MINUTES = 15;

/** Thrown inside the checkout transaction to trigger a clean rollback with a customer-facing message. */
class CheckoutValidationError extends Error {}

/**
 * Thrown when a concurrent request already claimed this Quotation (status
 * flip lost the race) — distinct from CheckoutValidationError because the
 * caller's recovery is different: look up the Order the winning request
 * produced and treat this as an idempotent success, not a user-facing error.
 */
class QuoteAcceptanceRaceError extends Error {}

type PreparedOrderItem = {
  /** Null for a CUSTOM_SOURCING-origin line — never VendorListing-backed (see modules/quotation's QuotationItem doc). */
  listingId: string | null;
  /** Null when a custom-sourcing line's supply is mixed/external — no live-catalogue vendor to attribute (M6). */
  vendorId: string | null;
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

    // Cart-checkout items are always listing-backed in practice — this
    // filter only exists to satisfy PreparedOrderItem's shared (M6-widened)
    // type, not because a null listingId can actually occur on this path.
    const reservableItems = preparedItems.filter(
      (item): item is PreparedOrderItem & { listingId: string } => item.listingId !== null,
    );
    await tx.inventoryReservation.createMany({
      data: reservableItems.map((item) => ({
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

type QuotationForAcceptance = NonNullable<
  Awaited<ReturnType<typeof quotationRepository.findWithItemsForAcceptance>>
>;

/**
 * Quote → Order conversion. Mirrors runCheckoutTransaction's shape (same
 * atomic-decrement availability check, same InventoryReservation creation —
 * reservation happens HERE, at acceptance, never at quote issuance) but
 * sources commercial values from the already-issued QuotationItem snapshot
 * verbatim rather than re-deriving them from live pricing (see
 * docs/workflows/workflows.md Workflow Q — "current listing prices cannot
 * rewrite historical Quotes"). The Quotation status claim happens first, so
 * a losing concurrent request never reaches the availability check at all.
 */
async function runQuoteAcceptanceTransaction(
  customerProfileId: string,
  quotation: QuotationForAcceptance,
  deliveryInfo: DeliveryInfo,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.quotation.updateMany({
      where: { id: quotation.id, customerProfileId, status: "ISSUED" },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new QuoteAcceptanceRaceError();
    }

    const preparedItems: PreparedOrderItem[] = [];

    for (const item of quotation.items) {
      if (item.listingId) {
        // Listing-backed line — every M5 INSTANT-origin item takes this
        // path, unchanged from before M6. A CUSTOM_SOURCING item is never
        // listing-backed (see modules/quotation's QuotationItem doc), so
        // this branch is INSTANT-only in practice.
        if (!item.vendorId) {
          throw new CheckoutValidationError("This quotation can't be completed automatically. Please contact support.");
        }

        const listing = await tx.vendorListing.findUnique({
          where: { id: item.listingId },
          select: { id: true, approvalStatus: true, listingStatus: true },
        });
        if (!listing || listing.approvalStatus !== "APPROVED" || listing.listingStatus !== "ACTIVE") {
          throw new CheckoutValidationError(
            `${item.description} is no longer available. This quotation can no longer be completed as issued.`,
          );
        }

        // Same atomic conditional decrement as cart checkout — availability
        // is revalidated at acceptance, never guaranteed at quote issuance.
        const decremented = await tx.vendorListing.updateMany({
          where: { id: item.listingId, availableQuantity: { gte: item.quantity } },
          data: { availableQuantity: { decrement: item.quantity } },
        });
        if (decremented.count !== 1) {
          throw new CheckoutValidationError(
            `Only a limited quantity of ${item.description} is left — not enough to complete this quotation. The quoted price remains unchanged; you can request an updated quote.`,
          );
        }
      }
      // Custom-sourcing line (M6, item.listingId === null): no live
      // catalogue stock to validate or decrement — the commercial
      // commitment was already locked in by staff via SourcingAllocation
      // at quote-issuance time. item.vendorId may be null (mixed/external
      // supply — no automatic Fulfilment for this line, CrownSource
      // operations manages it manually) or populated (single-vendor supply
      // — drives the normal, unmodified M2/M4 Fulfilment fan-out below).

      preparedItems.push({
        listingId: item.listingId,
        vendorId: item.vendorId,
        description: item.description,
        quantity: item.quantity,
        // Copied verbatim from the immutable QuotationItem snapshot — no
        // new pricing evaluation happens here.
        unitPrice: item.unitPrice.toNumber(),
        vendorPayableBasis: item.vendorPayableBasis.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
      });
    }

    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerProfileId,
        subtotal: quotation.subtotal,
        total: quotation.total,
        currency: quotation.currency,
        deliveryInfo: deliveryInfo as unknown as Prisma.InputJsonValue,
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
        originQuotationId: quotation.id,
      },
    });

    await tx.orderItem.createMany({
      data: preparedItems.map((item) => ({ ...item, orderId: order.id })),
    });

    // Only listing-backed lines ever hold a live reservation — a custom
    // line has nothing in VendorListing.availableQuantity to reserve.
    const reservableItems = preparedItems.filter(
      (item): item is PreparedOrderItem & { listingId: string } => item.listingId !== null,
    );
    if (reservableItems.length > 0) {
      await tx.inventoryReservation.createMany({
        data: reservableItems.map((item) => ({
          listingId: item.listingId,
          orderId: order.id,
          quantity: item.quantity,
          status: "HELD" as const,
          expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60_000),
        })),
      });
    }

    // M6: keep the originating CustomSourcingRequest's status in lockstep
    // with its Quotation, atomically with Order creation — never a
    // separate, potentially-inconsistent follow-up write.
    if (quotation.sourcingRequestId) {
      await tx.customSourcingRequest.update({
        where: { id: quotation.sourcingRequestId },
        data: { status: "ACCEPTED", closedAt: new Date() },
      });
      await tx.sourcingRequestActivity.create({
        data: {
          sourcingRequestId: quotation.sourcingRequestId,
          type: "quote_accepted",
          metadata: { orderId: order.id } as Prisma.InputJsonValue,
        },
      });
    }

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
   * Quote acceptance entry point (Workflow Q). Ownership/status/expiry are
   * re-checked here (defense in depth, before ever entering a transaction),
   * and again atomically inside runQuoteAcceptanceTransaction. Idempotent:
   * a Quotation already ACCEPTED — whether from an earlier successful call
   * or a concurrent request that won the race — returns the existing
   * orderId rather than erroring or creating a second Order (the
   * `Order.originQuotationId` unique constraint makes a second Order
   * impossible even under a true race).
   */
  async createOrderFromQuotation(
    customerProfileId: string,
    quotationId: string,
    deliveryInfo: DeliveryInfo,
  ): Promise<Result<{ orderId: string }>> {
    const quotation = await quotationRepository.findWithItemsForAcceptance(quotationId, customerProfileId);
    if (!quotation) {
      return err("Quotation not found.");
    }

    if (quotation.status === "ACCEPTED") {
      const existingOrder = await quotationRepository.findOrderIdByQuotationId(quotationId);
      if (existingOrder) {
        return ok({ orderId: existingOrder.id });
      }
      return err("This quotation has already been used.");
    }
    if (quotation.status !== "ISSUED") {
      return err("This quotation is no longer available.");
    }
    if (quotation.expiresAt.getTime() < Date.now()) {
      await quotationRepository.markExpiredIfDue(quotationId);
      return err("This quotation has expired. You can request an updated quote.");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const orderId = await runQuoteAcceptanceTransaction(customerProfileId, quotation, deliveryInfo);
        return ok({ orderId });
      } catch (error) {
        if (error instanceof CheckoutValidationError) {
          return err(error.message);
        }
        if (error instanceof QuoteAcceptanceRaceError) {
          const existingOrder = await quotationRepository.findOrderIdByQuotationId(quotationId);
          if (existingOrder) {
            return ok({ orderId: existingOrder.id });
          }
          return err("This quotation is no longer available.");
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt < 2
        ) {
          continue; // orderNumber collision — retry with a freshly generated one
        }
        console.error("Quote acceptance failed unexpectedly:", error);
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
   * Returns the Fulfilments newly created this call — one per distinct
   * vendor, empty on an idempotent no-op re-confirmation — plus the
   * customer's own userId so the caller can dispatch "order confirmed" and
   * per-vendor "new order" notifications exactly once per real
   * confirmation, never on a repeat/duplicate webhook-equivalent call.
   */
  async confirmOrderPayment(
    orderId: string,
  ): Promise<{ newFulfilments: { vendorId: string; fulfilmentId: string }[]; customerUserId: string | null }> {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          fulfilmentsCreatedAt: true,
          items: true,
          customerProfile: { select: { userId: true } },
        },
      });
      if (!order || order.status === "CONFIRMED") {
        return { newFulfilments: [], customerUserId: null }; // already confirmed — nothing to do (idempotent no-op)
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
        return { newFulfilments: [], customerUserId: null }; // Fulfilments already created for this confirmation
      }

      const itemsByVendor = new Map<string, typeof order.items>();
      for (const item of order.items) {
        if (!item.vendorId) continue; // custom-sourcing aggregate lines have no single vendor
        const group = itemsByVendor.get(item.vendorId) ?? [];
        group.push(item);
        itemsByVendor.set(item.vendorId, group);
      }

      const defaultReceivingLocation = await tx.receivingLocation.findFirst({
        where: { active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      const newFulfilments: { vendorId: string; fulfilmentId: string }[] = [];

      for (const [vendorId, items] of itemsByVendor) {
        const vendor = await tx.vendor.findUnique({ where: { id: vendorId }, select: { country: true } });
        // Snapshotted at creation time, per the same principle as OrderItem
        // pricing — never re-derived from live vendor data afterward.
        const origin = vendor?.country && vendor.country.trim().toLowerCase() !== "ghana"
          ? "INTERNATIONAL_INBOUND"
          : "DOMESTIC_COLLECTION";

        const fulfilment = await tx.fulfilment.create({ data: { orderId, vendorId, origin } });
        newFulfilments.push({ vendorId, fulfilmentId: fulfilment.id });
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
      return { newFulfilments, customerUserId: order.customerProfile.userId };
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
      latestPayment: order.payments[0]
        ? {
            reference: order.payments[0].reference,
            provider: order.payments[0].provider,
            network: order.payments[0].network,
            phoneMasked: order.payments[0].phoneMasked,
            amount: order.payments[0].amount.toNumber(),
            currency: order.payments[0].currency,
            initiatedAt: order.payments[0].initiatedAt,
          }
        : null,
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
