import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { ordersRepository } from "../orders/repository";
import { ordersService } from "../orders/service";
import { vendorsRepository } from "../vendors/repository";
import { mockPaymentProvider } from "./mockProvider";
import { ok, err, type Result } from "../../lib/result";
import { sendNewOrderToVendorEmail } from "../../lib/email";
import type { MockPaymentOutcome } from "./types";

function notifySafely(send: () => Promise<void>): void {
  send().catch((error) => console.error("Notification dispatch failed:", error));
}

/**
 * Post-commit notification boundary: fires only after confirmOrderPayment's
 * own transaction has already committed, and only for vendors that
 * genuinely received a NEW Fulfilment this call — never on an idempotent
 * re-confirmation (protects both payment idempotency and against duplicate
 * "new order" emails). A failing email provider can never roll back or
 * block the payment confirmation that already succeeded.
 */
async function notifyVendorsOfNewOrder(vendorIds: string[], orderNumber: string): Promise<void> {
  for (const vendorId of vendorIds) {
    const email = await vendorsRepository.findOwnerEmail(vendorId);
    if (!email) continue;
    notifySafely(() => sendNewOrderToVendorEmail({ to: email, orderNumber }));
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
      const { newVendorIds } = await ordersService.confirmOrderPayment(orderId);
      if (newVendorIds.length > 0) {
        void notifyVendorsOfNewOrder(newVendorIds, order.orderNumber);
      }
    }

    return ok({ succeeded: providerResult.succeeded });
  },
};
