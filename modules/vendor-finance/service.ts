import { prisma } from "../../lib/db";
import { env } from "../../lib/env";
import { vendorFinanceRepository } from "./repository";
import { generateSettlementNumber } from "../../lib/settlement-number";
import { generatePayoutReference } from "../../lib/payout-number";
import { normalizeGhanaPhone, maskGhanaPhone } from "../../lib/phone";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { vendorsRepository } from "../vendors/repository";
import { paystackPayoutProvider } from "./paystack-payout-provider";
import type { PayoutStatusOutcome } from "./payout-provider";
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

/** Shared by manual recordPayout and the automated (M12) payout paths — the one place a Vendor learns their settlement was paid. */
async function notifySettlementPaid(settlementId: string): Promise<void> {
  const settlement = await prisma.vendorSettlement.findUnique({ where: { id: settlementId }, select: { vendorId: true, settlementNumber: true, currency: true, netAmount: true } });
  if (!settlement) return;
  const owner = await vendorsRepository.findOwnerUserIdAndEmail(settlement.vendorId);
  if (!owner) return;
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

/**
 * The one funnel every automated-payout outcome (initiate, admin "Check
 * status", webhook reconciliation) passes through before touching
 * VendorEarning/VendorSettlement state — mirrors
 * modules/payments/service.ts's `applyVerifyOutcome`. Every transition is
 * the repository's own guarded `updateMany` (status: "PROCESSING" in the
 * WHERE clause), so a duplicate webhook or a racing poll can only ever
 * apply an outcome once.
 */
async function applyPayoutOutcome(settlementId: string, destinationType: "MOBILE_MONEY" | "BANK_TRANSFER", outcome: PayoutStatusOutcome): Promise<Result<null>> {
  if (outcome.status === "PAID") {
    const applied = await vendorFinanceRepository.markPayoutPaidTransactional(settlementId, {
      transferCode: outcome.transferCode,
      payoutMethod: destinationType,
    });
    if (applied) await notifySettlementPaid(settlementId);
    return ok(null);
  }
  if (outcome.status === "PROCESSING") {
    if (outcome.transferCode) await vendorFinanceRepository.setTransferCode(settlementId, outcome.transferCode);
    return ok(null);
  }
  if (outcome.status === "FAILED") {
    await vendorFinanceRepository.markPayoutFailedTransactional(settlementId, outcome.reasonSafe);
    return err(outcome.reasonSafe);
  }
  // UNKNOWN — network/timeout uncertainty. Stays PROCESSING; never guessed
  // at here. Resolved later via checkPayoutStatus (admin) or a webhook,
  // both of which land back on this same function.
  return ok(null);
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

    await notifySettlementPaid(settlementId);
    return ok(null);
  },

  // --- Automated Paystack payout (M12) ---------------------------------

  /**
   * "Send Payout" / "Retry Payout" — the single admin action for the
   * automated path. Claims the settlement (guarded — see
   * repository.claimSettlementForPayout for the double-click/concurrency
   * protection), resolves a Paystack recipient from the settlement's OWN
   * destinationSnapshot (never the Vendor's possibly-since-changed current
   * destination, and never re-created on retry), then initiates a real
   * transfer for the settlement's authoritative netAmount — never a
   * client-supplied amount.
   */
  async initiatePayout(settlementId: string, actorUserId: string): Promise<Result<null>> {
    if (env.PAYMENT_PROVIDER !== "paystack") return err("Automated payouts are only available when Paystack is the active payment provider.");

    const reference = generatePayoutReference();
    const claimed = await vendorFinanceRepository.claimSettlementForPayout(settlementId, actorUserId, reference);
    if (!claimed) return err("This settlement isn't ready to pay, or a payout is already in progress.");

    const settlement = await vendorFinanceRepository.findSettlementForPayout(settlementId);
    const destination = (settlement?.destinationSnapshot as unknown as PayoutDestinationSnapshot | null) ?? null;
    if (!settlement || !destination) {
      await vendorFinanceRepository.markPayoutFailedTransactional(settlementId, "No payout destination is recorded for this settlement.");
      return err("No payout destination is recorded for this settlement.");
    }

    let recipientCode = settlement.payoutProviderRecipientCode;
    if (!recipientCode) {
      const recipientResult = await paystackPayoutProvider.resolveRecipient({ destination, vendorName: settlement.vendor.companyName });
      if (!recipientResult.ok) {
        await vendorFinanceRepository.markPayoutFailedTransactional(settlementId, recipientResult.error);
        return err(recipientResult.error);
      }
      recipientCode = recipientResult.value;
      await vendorFinanceRepository.setRecipientCode(settlementId, recipientCode);
    }

    const outcome = await paystackPayoutProvider.initiate({
      reference,
      amount: settlement.netAmount.toNumber(),
      currency: settlement.currency as "GHS",
      recipientCode,
      reason: `CrownSourceGlobal settlement ${settlement.settlementNumber}`,
    });

    return applyPayoutOutcome(settlementId, destination.type, outcome);
  },

  /**
   * Safe, on-demand re-check for a PROCESSING settlement — independently
   * re-verifies with Paystack by CrownSourceGlobal's own reference, never
   * trusting a stale local guess. A no-op for any settlement that isn't
   * currently PROCESSING (already resolved, or never started).
   */
  async checkPayoutStatus(settlementId: string): Promise<Result<null>> {
    const settlement = await vendorFinanceRepository.findSettlementForPayout(settlementId);
    if (!settlement) return err("Settlement not found.");
    if (settlement.status !== "PROCESSING") return ok(null);
    if (!settlement.payoutProviderReference) return err("No payout reference recorded yet — please try again shortly.");

    const destination = (settlement.destinationSnapshot as unknown as PayoutDestinationSnapshot | null) ?? null;
    const outcome = await paystackPayoutProvider.verify(settlement.payoutProviderReference);
    return applyPayoutOutcome(settlementId, destination?.type ?? "MOBILE_MONEY", outcome);
  },

  /**
   * Paystack sends transfer.* events to the same webhook URL as charge.*
   * and refund.* events — routed here by
   * app/api/payments/paystack/webhook's existing event-prefix dispatch.
   * The webhook body itself is never
   * trusted for status; only its `reference` is used, purely as a lookup
   * key, before falling straight back into checkPayoutStatus's own
   * independent re-verification. An unknown reference or a settlement no
   * longer PROCESSING is a silent, safe no-op — never mutates an unrelated
   * settlement.
   */
  async handlePaystackTransferWebhook(body: unknown): Promise<void> {
    if (typeof body !== "object" || body === null || !("data" in body)) return;
    const data = (body as { data: unknown }).data;
    if (typeof data !== "object" || data === null || !("reference" in data)) return;
    const reference = (data as { reference?: unknown }).reference;
    if (typeof reference !== "string") return;

    const settlement = await vendorFinanceRepository.findSettlementByPayoutReference(reference);
    if (!settlement) return;
    await vendorFinanceService.checkPayoutStatus(settlement.id);
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

    let destination = row.destination;
    const destinationIsSnapshot = destination !== null;
    if (!destination) {
      // (M11.1) No locked snapshot exists yet — this settlement hasn't been
      // approved. Falls back to the Vendor's CURRENT payout configuration so
      // the admin isn't misled into thinking nothing is set (the previous
      // "Not set" here was the exact reported bug); this is never persisted
      // and never treated as the settlement's own authoritative destination
      // — approveSettlementTransactional still captures the real, immutable
      // snapshot at approval time, independent of this preview.
      const current = await vendorFinanceRepository.findPayoutDestination(row.vendorId);
      if (current) {
        destination = {
          type: current.type as never,
          momoAccountName: current.momoAccountName,
          momoPhone: current.momoPhone,
          momoNetwork: current.momoNetwork,
          bankAccountName: current.bankAccountName,
          bankName: current.bankName,
          bankAccountNumber: current.bankAccountNumber,
        };
      }
    }

    return ok({ ...row, destination, destinationIsSnapshot } as AdminSettlementDetailView);
  },

  searchSettlements(query: string) {
    return vendorFinanceRepository.searchSettlements(query);
  },
};
