import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import type { PayoutDestinationInput, PayoutDestinationSnapshot } from "./types";

function toNum(value: { toNumber: () => number } | null | undefined): number {
  return value ? value.toNumber() : 0;
}

const earningSummarySelect = {
  id: true,
  status: true,
  currency: true,
  originalPayableAmount: true,
  createdAt: true,
  eligibleAt: true,
  holdReasonSafe: true,
  orderId: true,
  order: { select: { orderNumber: true } },
  adjustments: { select: { amount: true } },
} as const;

function toEarningSummary(row: {
  id: string;
  status: string;
  currency: string;
  originalPayableAmount: Prisma.Decimal;
  createdAt: Date;
  eligibleAt: Date | null;
  holdReasonSafe: string | null;
  orderId: string;
  order: { orderNumber: string };
  adjustments: { amount: Prisma.Decimal }[];
}) {
  const adjustmentTotal = row.adjustments.reduce((sum, a) => sum + a.amount.toNumber(), 0);
  return {
    id: row.id,
    status: row.status as never,
    currency: row.currency,
    originalPayableAmount: row.originalPayableAmount.toNumber(),
    netAmount: row.originalPayableAmount.toNumber() + adjustmentTotal,
    orderId: row.orderId,
    orderNumber: row.order.orderNumber,
    createdAt: row.createdAt,
    eligibleAt: row.eligibleAt,
    holdReasonSafe: row.holdReasonSafe,
  };
}

export const vendorFinanceRepository = {
  // --- Eligibility sweep (M11) --------------------------------------------

  /** PENDING earnings whose Fulfilment has reached DELIVERED — candidates for the hold-window check. */
  findPendingEligibilityCandidates(limit: number) {
    return prisma.vendorEarning.findMany({
      where: { status: "PENDING", fulfilment: { status: "DELIVERED" } },
      select: {
        id: true,
        fulfilment: { select: { shipments: { orderBy: { deliveredAt: "desc" }, take: 1, select: { deliveredAt: true } } } },
      },
      take: limit,
    });
  },

  async markEligible(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await prisma.vendorEarning.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status: "ELIGIBLE", eligibleAt: new Date() },
    });
    return result.count;
  },

  // --- Vendor-facing --------------------------------------------------------

  async getVendorTotals(vendorId: string) {
    const [eligible, pending, onHold, paid, unappliedAdjustments] = await Promise.all([
      prisma.vendorEarning.aggregate({ where: { vendorId, status: "ELIGIBLE" }, _sum: { originalPayableAmount: true } }),
      prisma.vendorEarning.aggregate({ where: { vendorId, status: "PENDING" }, _sum: { originalPayableAmount: true } }),
      prisma.vendorEarning.aggregate({ where: { vendorId, status: "ON_HOLD" }, _sum: { originalPayableAmount: true } }),
      prisma.vendorEarning.aggregate({ where: { vendorId, status: "PAID" }, _sum: { originalPayableAmount: true } }),
      prisma.vendorFinancialAdjustment.aggregate({ where: { vendorId, appliedToSettlementId: null }, _sum: { amount: true } }),
    ]);
    return {
      eligible: toNum(eligible._sum.originalPayableAmount),
      pending: toNum(pending._sum.originalPayableAmount),
      onHold: toNum(onHold._sum.originalPayableAmount),
      paid: toNum(paid._sum.originalPayableAmount),
      unappliedAdjustmentTotal: toNum(unappliedAdjustments._sum.amount),
    };
  },

  async listEarningsForVendor(vendorId: string, filter: { status?: string }, page: number, pageSize: number) {
    const where = { vendorId, status: filter.status as never | undefined };
    const [rows, total] = await Promise.all([
      prisma.vendorEarning.findMany({
        where,
        select: earningSummarySelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vendorEarning.count({ where }),
    ]);
    return { rows: rows.map(toEarningSummary), total };
  },

  async getEarningDetailForVendor(vendorId: string, earningId: string) {
    const row = await prisma.vendorEarning.findFirst({
      where: { id: earningId, vendorId },
      select: {
        ...earningSummarySelect,
        fulfilmentId: true,
        fulfilment: { select: { status: true } },
        orderItem: { select: { description: true } },
        fulfilmentItem: { select: { quantity: true } },
        adjustments: { select: { id: true, amount: true, category: true, reason: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!row) return null;
    const summary = toEarningSummary(row);
    return {
      ...summary,
      fulfilmentId: row.fulfilmentId,
      fulfilmentStatus: row.fulfilment.status,
      orderItemDescription: row.orderItem.description,
      quantity: row.fulfilmentItem.quantity,
      adjustments: row.adjustments.map((a) => ({ id: a.id, amount: a.amount.toNumber(), category: a.category as never, reason: a.reason, createdAt: a.createdAt })),
    };
  },

  async listSettlementsForVendor(vendorId: string, filter: { status?: string }, page: number, pageSize: number) {
    const where = { vendorId, status: filter.status as never | undefined };
    const [rows, total] = await Promise.all([
      prisma.vendorSettlement.findMany({
        where,
        select: { id: true, settlementNumber: true, status: true, currency: true, netAmount: true, createdAt: true, payoutPaidAt: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vendorSettlement.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({ id: r.id, settlementNumber: r.settlementNumber, status: r.status as never, currency: r.currency, netAmount: r.netAmount.toNumber(), createdAt: r.createdAt, payoutPaidAt: r.payoutPaidAt })),
      total,
    };
  },

  async getSettlementDetail(settlementId: string, vendorId?: string) {
    const row = await prisma.vendorSettlement.findFirst({
      where: { id: settlementId, vendorId },
      select: {
        id: true,
        settlementNumber: true,
        status: true,
        currency: true,
        grossPayable: true,
        adjustmentTotal: true,
        netAmount: true,
        approvedAt: true,
        approvedByUserId: true,
        payoutMethod: true,
        payoutExternalReference: true,
        payoutNote: true,
        payoutPaidAt: true,
        payoutRecordedByUserId: true,
        reversedAt: true,
        reversalReason: true,
        destinationSnapshot: true,
        vendorId: true,
        vendor: { select: { companyName: true } },
        items: { select: { id: true, amount: true, vendorEarning: { select: { orderId: true, order: { select: { orderNumber: true } } } } } },
        adjustments: { select: { id: true, amount: true, category: true, reason: true, createdAt: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      settlementNumber: row.settlementNumber,
      status: row.status as never,
      currency: row.currency,
      grossPayable: row.grossPayable.toNumber(),
      adjustmentTotal: row.adjustmentTotal.toNumber(),
      netAmount: row.netAmount.toNumber(),
      createdAt: row.approvedAt ?? new Date(),
      approvedAt: row.approvedAt,
      payoutMethod: row.payoutMethod as never,
      payoutExternalReference: row.payoutExternalReference,
      payoutNote: row.payoutNote,
      payoutPaidAt: row.payoutPaidAt,
      reversedAt: row.reversedAt,
      reversalReason: row.reversalReason,
      destination: (row.destinationSnapshot as unknown as PayoutDestinationSnapshot) ?? null,
      items: row.items.map((i) => ({ id: i.id, amount: i.amount.toNumber(), orderId: i.vendorEarning.orderId, orderNumber: i.vendorEarning.order.orderNumber })),
      adjustments: row.adjustments.map((a) => ({ id: a.id, amount: a.amount.toNumber(), category: a.category as never, reason: a.reason, createdAt: a.createdAt })),
      vendorId: row.vendorId,
      vendorName: row.vendor.companyName,
      approvedByUserId: row.approvedByUserId,
      payoutRecordedByUserId: row.payoutRecordedByUserId,
    };
  },

  // --- Payout destination -----------------------------------------------

  findPayoutDestination(vendorId: string) {
    return prisma.vendorPayoutDestination.findUnique({ where: { vendorId } });
  },

  upsertPayoutDestination(vendorId: string, input: PayoutDestinationInput, actorUserId: string) {
    const data =
      input.type === "MOBILE_MONEY"
        ? { type: "MOBILE_MONEY" as const, momoAccountName: input.momoAccountName, momoPhone: input.momoPhone, momoNetwork: input.momoNetwork, bankAccountName: null, bankName: null, bankAccountNumber: null }
        : { type: "BANK_TRANSFER" as const, bankAccountName: input.bankAccountName, bankName: input.bankName, bankAccountNumber: input.bankAccountNumber, momoAccountName: null, momoPhone: null, momoNetwork: null };
    return prisma.vendorPayoutDestination.upsert({
      where: { vendorId },
      create: { vendorId, updatedByUserId: actorUserId, ...data },
      update: { updatedByUserId: actorUserId, ...data },
    });
  },

  // --- Admin ----------------------------------------------------------------

  async listVendorFinanceSummaries(): Promise<{ vendorId: string; vendorName: string }[]> {
    const rows = await prisma.vendorEarning.findMany({
      where: { status: { in: ["PENDING", "ON_HOLD", "ELIGIBLE"] } },
      distinct: ["vendorId"],
      select: { vendorId: true, vendor: { select: { companyName: true } } },
    });
    return rows.map((r) => ({ vendorId: r.vendorId, vendorName: r.vendor.companyName }));
  },

  async listEligibleEarningsForAdmin(vendorId: string) {
    const rows = await prisma.vendorEarning.findMany({
      where: { vendorId, status: "ELIGIBLE" },
      select: { id: true, currency: true, originalPayableAmount: true, orderId: true, order: { select: { orderNumber: true } }, eligibleAt: true },
      orderBy: { eligibleAt: "asc" },
    });
    return rows.map((r) => ({ id: r.id, currency: r.currency, originalPayableAmount: r.originalPayableAmount.toNumber(), orderId: r.orderId, orderNumber: r.order.orderNumber, eligibleAt: r.eligibleAt }));
  },

  /**
   * The core settlement-creation transaction. Claims exactly the requested
   * ELIGIBLE earnings (guarded — never silently includes fewer than
   * requested), sweeps every currently-unapplied adjustment for the vendor,
   * and refuses (rolls back, returns null) if the resulting net would be
   * <= 0. One Vendor per Settlement.
   */
  async createSettlementTransactional(params: { vendorId: string; earningIds: string[]; settlementNumber: string }) {
    return prisma.$transaction(async (tx) => {
      const settlement = await tx.vendorSettlement.create({
        data: { settlementNumber: params.settlementNumber, vendorId: params.vendorId, status: "DRAFT" },
      });

      const claimed = await tx.vendorEarning.updateMany({
        where: { id: { in: params.earningIds }, vendorId: params.vendorId, status: "ELIGIBLE" },
        data: { status: "INCLUDED_IN_SETTLEMENT" },
      });
      if (claimed.count !== params.earningIds.length) {
        throw new Error("SETTLEMENT_EARNINGS_NOT_ELIGIBLE");
      }

      const earnings = await tx.vendorEarning.findMany({
        where: { id: { in: params.earningIds } },
        select: { id: true, originalPayableAmount: true, currency: true },
      });
      const grossPayable = earnings.reduce((sum, e) => sum + e.originalPayableAmount.toNumber(), 0);
      await tx.vendorSettlementItem.createMany({
        data: earnings.map((e) => ({ settlementId: settlement.id, vendorEarningId: e.id, amount: e.originalPayableAmount })),
      });

      const unapplied = await tx.vendorFinancialAdjustment.findMany({
        where: { vendorId: params.vendorId, appliedToSettlementId: null },
        select: { id: true, amount: true },
      });
      if (unapplied.length > 0) {
        await tx.vendorFinancialAdjustment.updateMany({
          where: { id: { in: unapplied.map((a) => a.id) } },
          data: { appliedToSettlementId: settlement.id },
        });
      }
      const adjustmentTotal = unapplied.reduce((sum, a) => sum + a.amount.toNumber(), 0);
      const netAmount = grossPayable + adjustmentTotal;
      if (netAmount <= 0) {
        throw new Error("SETTLEMENT_NET_NOT_POSITIVE");
      }

      const currency = earnings[0]?.currency ?? "GHS";
      await tx.vendorSettlement.update({
        where: { id: settlement.id },
        data: { grossPayable, adjustmentTotal, netAmount, currency },
      });

      return { settlementId: settlement.id, netAmount };
    });
  },

  async approveSettlementTransactional(settlementId: string, actorUserId: string, destinationSnapshot: PayoutDestinationSnapshot | null) {
    const claim = await prisma.vendorSettlement.updateMany({
      where: { id: settlementId, status: "DRAFT" },
      data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: new Date(), destinationSnapshot: destinationSnapshot as unknown as Prisma.InputJsonValue },
    });
    return claim.count === 1;
  },

  async cancelSettlementTransactional(settlementId: string) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.vendorSettlement.updateMany({
        where: { id: settlementId, status: { in: ["DRAFT", "APPROVED"] } },
        data: { status: "CANCELLED" },
      });
      if (claim.count !== 1) return false;

      const items = await tx.vendorSettlementItem.findMany({ where: { settlementId }, select: { id: true, vendorEarningId: true } });
      if (items.length > 0) {
        await tx.vendorEarning.updateMany({
          where: { id: { in: items.map((i) => i.vendorEarningId) }, status: "INCLUDED_IN_SETTLEMENT" },
          data: { status: "ELIGIBLE" },
        });
        await tx.vendorSettlementItem.deleteMany({ where: { settlementId } });
      }
      await tx.vendorFinancialAdjustment.updateMany({ where: { appliedToSettlementId: settlementId }, data: { appliedToSettlementId: null } });
      return true;
    });
  },

  async recordPayoutTransactional(
    settlementId: string,
    input: { method: string; externalReference: string; paidAt: Date; note: string | null },
    actorUserId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.vendorSettlement.updateMany({
        where: { id: settlementId, status: "APPROVED" },
        data: {
          status: "PAID",
          payoutMethod: input.method as never,
          payoutExternalReference: input.externalReference,
          payoutNote: input.note,
          payoutPaidAt: input.paidAt,
          payoutRecordedByUserId: actorUserId,
        },
      });
      if (claim.count !== 1) return false;

      const items = await tx.vendorSettlementItem.findMany({ where: { settlementId }, select: { vendorEarningId: true } });
      await tx.vendorEarning.updateMany({
        where: { id: { in: items.map((i) => i.vendorEarningId) }, status: "INCLUDED_IN_SETTLEMENT" },
        data: { status: "PAID" },
      });
      return true;
    });
  },

  /**
   * Additive correction for a wrongly-recorded PAID settlement — never
   * edits the original payout fields. Creates a negative
   * SETTLEMENT_REVERSAL adjustment per included earning (netted into a
   * FUTURE settlement, same mechanism as a post-settlement refund) and
   * flags the settlement with reversedAt/reversalReason. The original
   * amount/reference/paidAt stay visible forever.
   */
  async reverseSettlementTransactional(settlementId: string, reason: string, actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.vendorSettlement.updateMany({
        where: { id: settlementId, status: "PAID", reversedAt: null },
        data: { reversedAt: new Date(), reversedByUserId: actorUserId, reversalReason: reason },
      });
      if (claim.count !== 1) return false;

      const settlement = await tx.vendorSettlement.findUniqueOrThrow({ where: { id: settlementId }, select: { vendorId: true } });
      const items = await tx.vendorSettlementItem.findMany({ where: { settlementId }, select: { vendorEarningId: true, amount: true } });
      for (const item of items) {
        await tx.vendorFinancialAdjustment.create({
          data: {
            vendorId: settlement.vendorId,
            vendorEarningId: item.vendorEarningId,
            amount: item.amount.negated(),
            category: "SETTLEMENT_REVERSAL",
            reason: `Reversal of settlement ${settlementId}: ${reason}`,
            createdByUserId: actorUserId,
          },
        });
      }
      return true;
    });
  },

  createManualAdjustment(params: { vendorId: string; vendorEarningId: string | null; amount: number; reason: string; actorUserId: string }) {
    return prisma.vendorFinancialAdjustment.create({
      data: {
        vendorId: params.vendorId,
        vendorEarningId: params.vendorEarningId!,
        amount: params.amount,
        category: "MANUAL_CORRECTION",
        reason: params.reason,
        createdByUserId: params.actorUserId,
      },
    });
  },

  async listSettlementsForAdmin(filter: { vendorId?: string; status?: string }, page: number, pageSize: number) {
    const where = { vendorId: filter.vendorId, status: filter.status as never | undefined };
    const [rows, total] = await Promise.all([
      prisma.vendorSettlement.findMany({
        where,
        select: { id: true, settlementNumber: true, status: true, currency: true, netAmount: true, createdAt: true, payoutPaidAt: true, vendorId: true, vendor: { select: { companyName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.vendorSettlement.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.id,
        settlementNumber: r.settlementNumber,
        status: r.status as never,
        currency: r.currency,
        netAmount: r.netAmount.toNumber(),
        vendorId: r.vendorId,
        vendorName: r.vendor.companyName,
        createdAt: r.createdAt,
        payoutPaidAt: r.payoutPaidAt,
      })),
      total,
    };
  },

  async searchSettlements(query: string, limit = 6) {
    const rows = await prisma.vendorSettlement.findMany({
      where: { OR: [{ settlementNumber: { contains: query, mode: "insensitive" } }, { payoutExternalReference: { contains: query, mode: "insensitive" } }] },
      select: { id: true, settlementNumber: true },
      take: limit,
    });
    return rows;
  },

  // --- Hooks called from modules/resolutions (M9 -> M11 integration) -------

  /** Applies an ON_HOLD state to the earnings for the given FulfilmentItems — called inline within resolutionsRepository's own approval transaction. */
  applyResolutionHoldTx(tx: Prisma.TransactionClient, fulfilmentItemIds: string[], caseId: string, holdReasonSafe: string, holdInternalNote: string, staffId: string) {
    return tx.vendorEarning.updateMany({
      where: { fulfilmentItemId: { in: fulfilmentItemIds }, status: { in: ["PENDING", "ELIGIBLE"] } },
      data: { status: "ON_HOLD", holdReasonSafe, holdInternalNote, heldAt: new Date(), heldByUserId: staffId, heldForResolutionCaseId: caseId },
    });
  },

  async createResolutionAdjustmentTx(tx: Prisma.TransactionClient, params: { fulfilmentItemId: string; vendorId: string; amount: number; resolutionCaseId: string; reason: string }) {
    const earning = await tx.vendorEarning.findUnique({ where: { fulfilmentItemId: params.fulfilmentItemId }, select: { id: true } });
    if (!earning) return null;
    return tx.vendorFinancialAdjustment.create({
      data: { vendorId: params.vendorId, vendorEarningId: earning.id, amount: params.amount, category: "RESOLUTION_REFUND", reason: params.reason, resolutionCaseId: params.resolutionCaseId },
    });
  },

  cancelEarningsForFulfilmentTx(tx: Prisma.TransactionClient, fulfilmentId: string) {
    return tx.vendorEarning.updateMany({
      where: { fulfilmentId, status: { in: ["PENDING", "ON_HOLD", "ELIGIBLE"] } },
      data: { status: "CANCELLED" },
    });
  },

  async releaseHoldForResolutionCase(caseId: string) {
    const result = await prisma.vendorEarning.updateMany({
      where: { heldForResolutionCaseId: caseId, status: "ON_HOLD" },
      data: { status: "PENDING", holdReasonSafe: null, holdInternalNote: null, releasedAt: new Date(), heldForResolutionCaseId: null },
    });
    return result.count;
  },
};
