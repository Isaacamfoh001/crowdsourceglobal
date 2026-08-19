import { prisma } from "../../lib/db";
import { env } from "../../lib/env";
import { vendorFinanceRepository } from "./repository";
import { generateSettlementNumber } from "../../lib/settlement-number";
import { normalizeGhanaPhone, maskGhanaPhone } from "../../lib/phone";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { vendorsRepository } from "../vendors/repository";
import { ok, err, type Result } from "../../lib/result";
import type {
  AdminSettlementDetailView,
  AdminVendorFinanceSummaryView,
  PayoutDestinationInput,
  PayoutDestinationSnapshot,
  PayoutDestinationView,
  VendorEarningDetailView,
  VendorEarningSummaryView,
  VendorFinanceOverview,
  VendorSettlementDetailView,
  VendorSettlementSummaryView,
} from "./types";

const PAGE_SIZE = 20;

function maskAccountNumber(value: string): string {
  if (value.length <= 4) return "****";
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

function toMaskedDestination(destination: PayoutDestinationSnapshot | null): PayoutDestinationSnapshot | null {
  if (!destination) return null;
  if (destination.type === "MOBILE_MONEY") {
    return { ...destination, momoPhone: destination.momoPhone ? maskGhanaPhone(destination.momoPhone) : null };
  }
  return { ...destination, bankAccountNumber: destination.bankAccountNumber ? maskAccountNumber(destination.bankAccountNumber) : null };
}

export const vendorFinanceService = {
  // --- Background sweep (M11) — see scripts/sweep-earnings-eligibility.ts ---

  /**
   * Time-based eligibility transition ONLY: WAITING_PERIOD -> ELIGIBLE once
   * the configured VENDOR_PAYOUT_HOLD_HOURS have elapsed since the earning's
   * own `deliveredAt` (M11.1 — set event-driven when the Fulfilment first
   * reached DELIVERED, see modules/fulfilment/repository.ts's
   * progressShipment). This sweep is deliberately narrow: it is NEVER
   * responsible for creating holds, cancelling fully-refunded earnings, or
   * applying adjustments — those are all event-driven (resolutionsRepository)
   * and would already have moved an earning out of WAITING_PERIOD before this
   * ever runs. ON_HOLD earnings are never candidates here at all.
   */
  async sweepEligibleEarnings(limit = 200): Promise<{ madeEligible: number }> {
    const candidates = await vendorFinanceRepository.findWaitingPeriodCandidates(limit);
    const holdMs = env.VENDOR_PAYOUT_HOLD_HOURS * 60 * 60 * 1000;
    const now = Date.now();
    const readyIds = candidates.filter((c) => c.deliveredAt && now - c.deliveredAt.getTime() >= holdMs).map((c) => c.id);
    const madeEligible = await vendorFinanceRepository.markEligible(readyIds);
    return { madeEligible };
  },

  // --- Vendor-facing ---------------------------------------------------------

  async getOverviewForVendor(vendorId: string): Promise<VendorFinanceOverview> {
    const totals = await vendorFinanceRepository.getVendorTotals(vendorId);
    return {
      currency: "GHS",
      availableForSettlement: Math.max(0, totals.eligible + totals.unappliedAdjustmentTotal),
      pending: totals.pending,
      waitingPeriod: totals.waitingPeriod,
      onHold: totals.onHold,
      paidToDate: totals.paid,
      unappliedAdjustmentTotal: totals.unappliedAdjustmentTotal,
    };
  },

  async listEarningsForVendor(vendorId: string, status: string | undefined, page: number): Promise<{ rows: VendorEarningSummaryView[]; total: number; pageSize: number }> {
    const { rows, total } = await vendorFinanceRepository.listEarningsForVendor(vendorId, { status }, page, PAGE_SIZE);
    return { rows: rows as VendorEarningSummaryView[], total, pageSize: PAGE_SIZE };
  },

  async getEarningDetailForVendor(vendorId: string, earningId: string): Promise<Result<VendorEarningDetailView>> {
    const row = await vendorFinanceRepository.getEarningDetailForVendor(vendorId, earningId);
    if (!row) return err("Earning not found.");
    return ok(row as VendorEarningDetailView);
  },

  async listSettlementsForVendor(vendorId: string, status: string | undefined, page: number): Promise<{ rows: VendorSettlementSummaryView[]; total: number; pageSize: number }> {
    const { rows, total } = await vendorFinanceRepository.listSettlementsForVendor(vendorId, { status }, page, PAGE_SIZE);
    return { rows: rows as VendorSettlementSummaryView[], total, pageSize: PAGE_SIZE };
  },

  async getSettlementDetailForVendor(vendorId: string, settlementId: string): Promise<Result<VendorSettlementDetailView>> {
    const row = await vendorFinanceRepository.getSettlementDetail(settlementId, vendorId);
    if (!row) return err("Settlement not found.");
    return ok({ ...row, destination: toMaskedDestination(row.destination) } as VendorSettlementDetailView);
  },

  async getPayoutDestinationForVendor(vendorId: string): Promise<PayoutDestinationView> {
    const row = await vendorFinanceRepository.findPayoutDestination(vendorId);
    if (!row) return null;
    return {
      type: row.type as never,
      momoAccountName: row.momoAccountName,
      momoPhoneMasked: row.momoPhone ? maskGhanaPhone(row.momoPhone) : null,
      momoNetwork: row.momoNetwork,
      bankAccountName: row.bankAccountName,
      bankName: row.bankName,
      bankAccountNumberMasked: row.bankAccountNumber ? maskAccountNumber(row.bankAccountNumber) : null,
      updatedAt: row.updatedAt,
    };
  },

  /** OWNER-only — enforced here, never trusting UI visibility (CLAUDE.md §12). */
  async upsertPayoutDestinationForVendor(vendorId: string, role: string, actorUserId: string, input: PayoutDestinationInput): Promise<Result<null>> {
    if (role !== "OWNER") return err("Only the Vendor account owner can change payout details.");

    if (input.type === "MOBILE_MONEY") {
      const normalized = normalizeGhanaPhone(input.momoPhone);
      if (!normalized) return err("Enter a valid Ghana mobile number.");
      if (!input.momoAccountName.trim()) return err("Enter the account name on this Mobile Money wallet.");
      await vendorFinanceRepository.upsertPayoutDestination(vendorId, { ...input, momoPhone: normalized }, actorUserId);
    } else {
      if (!input.bankAccountName.trim() || !input.bankName.trim() || !input.bankAccountNumber.trim()) {
        return err("Fill in all bank account details.");
      }
      await vendorFinanceRepository.upsertPayoutDestination(vendorId, input, actorUserId);
    }
    return ok(null);
  },

  // --- M9 integration (called from modules/resolutions) ---------------------

  /** Standard vendor-safe copy — never the internal case-tracking detail. */
  holdReasonSafeForResolutionCase(): string {
    return "Order issue under review";
  },

  async releaseHoldForResolutionCase(caseId: string): Promise<number> {
    return vendorFinanceRepository.releaseHoldForResolutionCase(caseId);
  },

  // --- Admin ------------------------------------------------------------

  async listVendorFinanceForAdmin(): Promise<AdminVendorFinanceSummaryView[]> {
    const vendors = await vendorFinanceRepository.listVendorFinanceSummaries();
    const results: AdminVendorFinanceSummaryView[] = [];
    for (const v of vendors) {
      const totals = await vendorFinanceRepository.getVendorTotals(v.vendorId);
      results.push({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
        currency: "GHS",
        eligible: totals.eligible,
        pending: totals.pending,
        waitingPeriod: totals.waitingPeriod,
        onHold: totals.onHold,
        unappliedAdjustmentTotal: totals.unappliedAdjustmentTotal,
        paidToDate: totals.paid,
      });
    }
    return results;
  },

  async getVendorFinanceDetailForAdmin(vendorId: string) {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { companyName: true } });
    if (!vendor) return null;
    const totals = await vendorFinanceRepository.getVendorTotals(vendorId);
    const destination = await vendorFinanceRepository.findPayoutDestination(vendorId);
    const { rows: recentSettlements } = await vendorFinanceRepository.listSettlementsForVendor(vendorId, {}, 1, 10);
    return {
      vendorId,
      vendorName: vendor.companyName,
      currency: "GHS",
      eligible: totals.eligible,
      pending: totals.pending,
      waitingPeriod: totals.waitingPeriod,
      onHold: totals.onHold,
      unappliedAdjustmentTotal: totals.unappliedAdjustmentTotal,
      paidToDate: totals.paid,
      destination,
      recentSettlements,
    };
  },

  listEligibleEarningsForAdmin(vendorId: string) {
    return vendorFinanceRepository.listEligibleEarningsForAdmin(vendorId);
  },

  async createSettlement(vendorId: string, earningIds: string[]): Promise<Result<{ settlementId: string }>> {
    if (earningIds.length === 0) return err("Select at least one eligible earning.");
    try {
      const result = await vendorFinanceRepository.createSettlementTransactional({ vendorId, earningIds, settlementNumber: generateSettlementNumber() });
      return ok({ settlementId: result.settlementId });
    } catch (error) {
      if (error instanceof Error && error.message === "SETTLEMENT_EARNINGS_NOT_ELIGIBLE") {
        return err("One or more selected earnings are no longer eligible — someone may have already settled them.");
      }
      if (error instanceof Error && error.message === "SETTLEMENT_NET_NOT_POSITIVE") {
        return err("This vendor has outstanding adjustments that exceed the selected earnings. Select more earnings, or wait for future earnings to offset the balance.");
      }
      console.error("Settlement creation failed unexpectedly:", error);
      return err("Something went wrong creating the settlement. Please try again.");
    }
  },

  async approveSettlement(settlementId: string, actorUserId: string): Promise<Result<null>> {
    const settlement = await prisma.vendorSettlement.findUnique({ where: { id: settlementId }, select: { vendorId: true, settlementNumber: true, currency: true, netAmount: true } });
    if (!settlement) return err("Settlement not found.");

    const destination = await vendorFinanceRepository.findPayoutDestination(settlement.vendorId);
    const snapshot: PayoutDestinationSnapshot | null = destination
      ? {
          type: destination.type as never,
          momoAccountName: destination.momoAccountName,
          momoPhone: destination.momoPhone,
          momoNetwork: destination.momoNetwork,
          bankAccountName: destination.bankAccountName,
          bankName: destination.bankName,
          bankAccountNumber: destination.bankAccountNumber,
        }
      : null;

    const applied = await vendorFinanceRepository.approveSettlementTransactional(settlementId, actorUserId, snapshot);
    if (!applied) return err("This settlement is no longer in draft.");

    const owner = await vendorsRepository.findOwnerUserIdAndEmail(settlement.vendorId);
    if (owner) {
      await notificationsService.notify({
        recipientUserId: owner.userId,
        type: "VENDOR_SETTLEMENT_APPROVED",
        title: "Your settlement has been approved",
        body: `Settlement ${settlement.settlementNumber} of ${settlement.currency} ${settlement.netAmount.toString()} has been approved and is being prepared for payout.`,
        targetUrl: notificationLinks.vendorSettlement(settlementId),
        eventKey: `settlement-approved:${settlementId}`,
        email: {
          to: owner.email,
          subject: "Your settlement has been approved",
          templateKey: "vendor-settlement-approved",
          templateData: { settlementNumber: settlement.settlementNumber, currency: settlement.currency, netAmount: settlement.netAmount.toString(), settlementId },
        },
      });
    }
    return ok(null);
  },

  async cancelSettlement(settlementId: string): Promise<Result<null>> {
    const applied = await vendorFinanceRepository.cancelSettlementTransactional(settlementId);
    if (!applied) return err("This settlement can no longer be cancelled.");
    return ok(null);
  },

  async recordPayout(
    settlementId: string,
    input: { method: string; externalReference: string; paidAt: string; note: string },
    actorUserId: string,
  ): Promise<Result<null>> {
    if (!["BANK_TRANSFER", "MOBILE_MONEY", "OTHER"].includes(input.method)) return err("Choose a payout method.");
    if (!input.externalReference.trim()) return err("Enter the external reference for this payout.");
    const paidAt = new Date(input.paidAt);
    if (Number.isNaN(paidAt.getTime())) return err("Enter a valid payout date.");

    const settlement = await prisma.vendorSettlement.findUnique({ where: { id: settlementId }, select: { vendorId: true, settlementNumber: true, currency: true, netAmount: true } });
    if (!settlement) return err("Settlement not found.");

    const applied = await vendorFinanceRepository.recordPayoutTransactional(
      settlementId,
      { method: input.method, externalReference: input.externalReference.trim(), paidAt, note: input.note.trim() || null },
      actorUserId,
    );
    if (!applied) return err("This settlement isn't approved yet, or has already been paid.");

    const owner = await vendorsRepository.findOwnerUserIdAndEmail(settlement.vendorId);
    if (owner) {
      await notificationsService.notify({
        recipientUserId: owner.userId,
        type: "VENDOR_SETTLEMENT_PAID",
        title: "Your settlement has been paid",
        body: `Your settlement ${settlement.settlementNumber} of ${settlement.currency} ${settlement.netAmount.toString()} has been paid.`,
        targetUrl: notificationLinks.vendorSettlement(settlementId),
        eventKey: `settlement-paid:${settlementId}`,
        email: {
          to: owner.email,
          subject: "Your settlement has been paid",
          templateKey: "vendor-settlement-paid",
          templateData: { settlementNumber: settlement.settlementNumber, currency: settlement.currency, netAmount: settlement.netAmount.toString(), settlementId },
        },
      });
    }
    return ok(null);
  },

  async reverseSettlement(settlementId: string, reason: string, actorUserId: string): Promise<Result<null>> {
    if (reason.trim().length < 3) return err("Explain why this payout is being reversed.");
    const applied = await vendorFinanceRepository.reverseSettlementTransactional(settlementId, reason.trim(), actorUserId);
    if (!applied) return err("This settlement isn't paid, or has already been reversed.");
    return ok(null);
  },

  async createManualAdjustment(params: { vendorId: string; vendorEarningId: string | null; amount: number; reason: string; actorUserId: string }): Promise<Result<null>> {
    if (params.amount === 0) return err("Enter a non-zero adjustment amount.");
    if (params.reason.trim().length < 3) return err("Explain the reason for this correction.");
    if (!params.vendorEarningId) return err("Select the earning this correction applies to.");
    await vendorFinanceRepository.createManualAdjustment({ ...params, reason: params.reason.trim() });
    return ok(null);
  },

  async listSettlementsForAdmin(filter: { vendorId?: string; status?: string }, page: number) {
    const { rows, total } = await vendorFinanceRepository.listSettlementsForAdmin(filter, page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  async getSettlementDetailForAdmin(settlementId: string): Promise<Result<AdminSettlementDetailView>> {
    const row = await vendorFinanceRepository.getSettlementDetail(settlementId);
    if (!row) return err("Settlement not found.");
    return ok(row as AdminSettlementDetailView);
  },

  searchSettlements(query: string) {
    return vendorFinanceRepository.searchSettlements(query);
  },
};
