import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { ordersRepository } from "../orders/repository";
import { ordersService } from "../orders/service";
import { vendorsRepository } from "../vendors/repository";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { mockPaymentProvider } from "./mockProvider";
import { ok, err, type Result } from "../../lib/result";
import type { MockPaymentOutcome } from "./types";

/**
 * Post-commit notification boundary: fires only after confirmOrderPayment's
 * own transaction has already committed, and only for vendors that
 * genuinely received a NEW Fulfilment this call — never on an idempotent
 * re-confirmation (protects both payment idempotency and against duplicate
 * "new order" notifications).
 */
async function notifyVendorsOfNewOrder(
  fulfilments: { vendorId: string; fulfilmentId: string }[],
  orderNumber: string,
): Promise<void> {
  for (const { vendorId, fulfilmentId } of fulfilments) {
    const owner = await vendorsRepository.findOwnerUserIdAndEmail(vendorId);
    if (!owner) continue;
    await notificationsService.notify({
      recipientUserId: owner.userId,
      type: "VENDOR_NEW_ORDER",
      title: "New order to prepare",
      body: `You have a new order to prepare: ${orderNumber}.`,
      targetUrl: notificationLinks.vendorOrder(fulfilmentId),
      eventKey: `vendor-new-order:${fulfilmentId}`,
      email: {
        to: owner.email,
        subject: "You have a new order to prepare",
        templateKey: "vendor-new-order",
        templateData: { orderNumber, fulfilmentId },
      },
    });
  }
}

async function resultForExistingKey(key: string): Promise<Result<{ succeeded: boolean }> | null> {
  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (!existing) {
    return null;
  }
  const payment = await prisma.payment.findUnique({ where: { id: existing.resultRef } });
  if (!payment) {
    return null;
  }
  return ok({ succeeded: payment.status === "SUCCEEDED" });
}

export const paymentsService = {
  /**
   * Protects against double-clicking Pay / a retried submission: the
   * `idempotencyKey` is generated once per payment-page render (a hidden
   * form field), so a duplicate submission carries the same key and
   * returns the already-recorded outcome instead of creating a second
   * Payment or confirming the order twice.
   */
  async attemptMockPayment(params: {
    customerProfileId: string;
    orderId: string;
    outcome: MockPaymentOutcome;
    idempotencyKey: string;
  }): Promise<Result<{ succeeded: boolean }>> {
    const { customerProfileId, orderId, outcome, idempotencyKey } = params;

    const existingResult = await resultForExistingKey(idempotencyKey);
    if (existingResult) {
      return existingResult;
    }

    const order = await ordersRepository.findOwnershipAndStatus(orderId, customerProfileId);
    if (!order) {
      return err("Order not found.");
    }
    if (order.status !== "PENDING_PAYMENT") {
      // Already resolved by an earlier attempt (or a stale reload) — report
      // the order's actual state rather than reprocessing.
      return ok({ succeeded: order.status === "CONFIRMED" });
    }

    const providerResult = await mockPaymentProvider.charge(outcome);

    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            orderId,
            provider: mockPaymentProvider.name,
            method: "mock",
            amount: order.total,
            currency: order.currency,
            status: providerResult.succeeded ? "SUCCEEDED" : "FAILED",
            providerEventId: providerResult.providerEventId,
            confirmedAt: new Date(),
          },
        });
        await tx.idempotencyKey.create({
          data: { key: idempotencyKey, scope: "PAYMENT", resultRef: created.id },
        });
      });
    } catch (error) {
      // Lost a race with a concurrent duplicate submission that claimed
      // this idempotency key first — return its result rather than error.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const raced = await resultForExistingKey(idempotencyKey);
        if (raced) {
          return raced;
        }
      }
      console.error("Mock payment attempt failed unexpectedly:", error);
      return err("Something went wrong processing payment. Please try again.");
    }

    if (providerResult.succeeded) {
      const { newFulfilments, customerUserId } = await ordersService.confirmOrderPayment(orderId);
      if (customerUserId) {
        await notificationsService.notify({
          recipientUserId: customerUserId,
          type: "ORDER_CONFIRMED",
          title: "Order confirmed",
          body: `Your CrownSourceGlobal order ${order.orderNumber} is confirmed and vendors have been notified.`,
          targetUrl: notificationLinks.customerOrder(orderId),
          eventKey: `order-confirmed:${orderId}`,
          email: {
            to: order.customerProfile.user.email,
            subject: "Your order is confirmed",
            templateKey: "order-confirmed",
            templateData: { orderNumber: order.orderNumber, orderId },
          },
        });
      }
      if (newFulfilments.length > 0) {
        void notifyVendorsOfNewOrder(newFulfilments, order.orderNumber);
      }
    }

    return ok({ succeeded: providerResult.succeeded });
  },
};
