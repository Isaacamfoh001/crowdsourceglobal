export type EarningStatus = "PENDING" | "WAITING_PERIOD" | "ON_HOLD" | "ELIGIBLE" | "INCLUDED_IN_SETTLEMENT" | "PAID" | "CANCELLED";

export type AdjustmentCategory = "RESOLUTION_REFUND" | "MANUAL_CORRECTION" | "SETTLEMENT_REVERSAL";

export type SettlementStatus = "DRAFT" | "APPROVED" | "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";

export type PayoutMethod = "BANK_TRANSFER" | "MOBILE_MONEY" | "OTHER";

export type PayoutDestinationType = "MOBILE_MONEY" | "BANK_TRANSFER";

/** Safe summary — no internal note, no other Vendor's data. */
export type VendorEarningSummaryView = {
  id: string;
  status: EarningStatus;
  currency: string;
  originalPayableAmount: number;
  netAmount: number;
  orderId: string;
  orderNumber: string;
  createdAt: Date;
  eligibleAt: Date | null;
  holdReasonSafe: string | null;
};

export type VendorEarningAdjustmentView = {
  id: string;
  amount: number;
  category: AdjustmentCategory;
  reason: string;
  createdAt: Date;
};

export type VendorEarningDetailView = VendorEarningSummaryView & {
  fulfilmentId: string;
  fulfilmentStatus: string;
  orderItemDescription: string;
  quantity: number;
  adjustments: VendorEarningAdjustmentView[];
};

export type VendorFinanceOverview = {
  currency: string;
  availableForSettlement: number;
  /** Fulfilment work still outstanding — the Vendor hasn't delivered yet. */
  pending: number;
  /** (M11.1) Delivered, but the post-delivery settlement window hasn't elapsed yet. */
  waitingPeriod: number;
  onHold: number;
  paidToDate: number;
  /** Sum of unapplied adjustments not yet reflected in availableForSettlement's earnings (can be negative — an outstanding debit). */
  unappliedAdjustmentTotal: number;
};

export type VendorSettlementSummaryView = {
  id: string;
  settlementNumber: string;
  status: SettlementStatus;
  currency: string;
  netAmount: number;
  createdAt: Date;
  payoutPaidAt: Date | null;
};

export type VendorSettlementItemView = {
  id: string;
  amount: number;
  orderId: string;
  orderNumber: string;
};

export type PayoutDestinationSnapshot = {
  type: PayoutDestinationType;
  momoAccountName?: string | null;
  momoPhone?: string | null;
  momoNetwork?: string | null;
  bankAccountName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
};

export type VendorSettlementDetailView = VendorSettlementSummaryView & {
  grossPayable: number;
  adjustmentTotal: number;
  approvedAt: Date | null;
  payoutMethod: PayoutMethod | null;
  payoutExternalReference: string | null;
  payoutNote: string | null;
  /** (M12) "PAYSTACK" for an automated payout; null for a manually-recorded one. */
  payoutProvider: string | null;
  payoutProviderReference: string | null;
  payoutProviderTransferCode: string | null;
  /** (M12) Admin-facing only — set when status = FAILED. Never shown to the Vendor. */
  payoutFailureReasonSafe: string | null;
  reversedAt: Date | null;
  reversalReason: string | null;
  /** Masked for Vendor display — see toMaskedDestination. */
  destination: PayoutDestinationSnapshot | null;
  items: VendorSettlementItemView[];
  adjustments: VendorEarningAdjustmentView[];
};

/** Vendor-facing — masked. */
export type PayoutDestinationView = {
  type: PayoutDestinationType;
  momoAccountName: string | null;
  momoPhoneMasked: string | null;
  momoNetwork: string | null;
  bankAccountName: string | null;
  bankName: string | null;
  bankAccountNumberMasked: string | null;
  updatedAt: Date;
} | null;

export type PayoutDestinationInput =
  | { type: "MOBILE_MONEY"; momoAccountName: string; momoPhone: string; momoNetwork: "MTN" | "TELECEL" | "AT" }
  | { type: "BANK_TRANSFER"; bankAccountName: string; bankName: string; bankAccountNumber: string };

// --- Admin views -----------------------------------------------------------

export type AdminVendorFinanceSummaryView = {
  vendorId: string;
  vendorName: string;
  currency: string;
  eligible: number;
  pending: number;
  waitingPeriod: number;
  onHold: number;
  unappliedAdjustmentTotal: number;
  paidToDate: number;
};

export type AdminEligibleEarningView = {
  id: string;
  currency: string;
  originalPayableAmount: number;
  orderId: string;
  orderNumber: string;
  eligibleAt: Date | null;
};

export type AdminSettlementSummaryView = {
  id: string;
  settlementNumber: string;
  status: SettlementStatus;
  currency: string;
  netAmount: number;
  vendorId: string;
  vendorName: string;
  createdAt: Date;
  payoutPaidAt: Date | null;
};

export type AdminSettlementDetailView = VendorSettlementDetailView & {
  vendorId: string;
  vendorName: string;
  approvedByUserId: string | null;
  payoutRecordedByUserId: string | null;
  /**
   * (M11.1) false when `destination` is a live fallback to the Vendor's
   * CURRENT payout configuration (no locked snapshot exists yet — this
   * settlement hasn't been approved). true once the settlement's own
   * immutable destinationSnapshot exists. Never conflate the two: only the
   * snapshot is what actually gets/got paid.
   */
  destinationIsSnapshot: boolean;
};
