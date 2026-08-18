export type ResolutionCaseStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "AWAITING_CUSTOMER"
  | "AWAITING_VENDOR"
  | "RESOLUTION_APPROVED"
  | "RESOLUTION_IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED"
  | "CLOSED";

export type ResolutionIssueType =
  | "CUSTOMER_CANCELLATION_REQUEST"
  | "VENDOR_CANNOT_FULFIL"
  | "ITEM_DAMAGED"
  | "WRONG_ITEM"
  | "MISSING_ITEM"
  | "MISSING_QUANTITY"
  | "ITEM_NOT_AS_DESCRIBED"
  | "PACKAGE_NOT_RECEIVED"
  | "DELIVERY_FAILURE"
  | "OTHER";

export type RequestedResolution = "CANCELLATION" | "REFUND" | "PARTIAL_REFUND" | "REPLACEMENT" | "REDELIVERY" | "OTHER";

export type ResolutionDecision =
  | "NO_ACTION"
  | "FULL_REFUND"
  | "PARTIAL_REFUND"
  | "REPLACEMENT"
  | "RETURN_AND_REFUND"
  | "RETURN_AND_REPLACEMENT"
  | "REDELIVERY";

export type ResolutionResponsibility = "VENDOR" | "CROWNSOURCE" | "LOGISTICS" | "CUSTOMER" | "EXTERNAL_SUPPLIER" | "SHARED_OTHER";

export type RefundStatus = "PENDING_APPROVAL" | "APPROVED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type ReturnStatus = "APPROVED" | "IN_TRANSIT" | "RECEIVED" | "INSPECTED" | "COMPLETED";
export type ReturnInspectionOutcome = "RESELLABLE" | "NOT_RESELLABLE";

/** Client input for opening a case — never trusted for financial/authority fields. */
export type SubmitCaseInput = {
  orderId: string;
  issueType: ResolutionIssueType;
  requestedResolution?: RequestedResolution;
  description: string;
  fulfilmentId?: string;
  items: { orderItemId: string; quantity: number }[];
};

export type CancellationEligibility = "SAFE" | "NEEDS_REVIEW" | "BLOCKED";

export type OrderCancellationContext = {
  orderId: string;
  orderNumber: string;
  fulfilments: {
    fulfilmentId: string;
    vendorName: string;
    status: string;
    eligibility: CancellationEligibility;
    items: { orderItemId: string; description: string; quantity: number; unitPrice: number }[];
  }[];
};

export type CaseItemView = {
  id: string;
  orderItemId: string;
  description: string;
  quantityAffected: number;
  purchasedQuantity: number;
  unitPrice: number;
  issueType: ResolutionIssueType;
  requestedResolution: RequestedResolution | null;
  approvedResolution: ResolutionDecision | null;
  approvedRefundAmount: number | null;
  replacementQuantity: number | null;
};

export type CaseAttachmentView = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export type CaseActivityView = {
  id: string;
  type: string;
  createdAt: Date;
  /** Only ever populated on the admin view — see toActivityView. */
  metadata: Record<string, unknown> | null;
};

export type CustomerCaseSummary = {
  id: string;
  caseNumber: string;
  status: ResolutionCaseStatus;
  statusLabel: string;
  issueType: ResolutionIssueType;
  orderId: string;
  orderNumber: string;
  createdAt: Date;
};

export type CustomerCaseDetail = CustomerCaseSummary & {
  customerDescription: string;
  customerSafeDecisionReason: string | null;
  items: CaseItemView[];
  attachments: CaseAttachmentView[];
  refunds: { id: string; amount: number; currency: string; status: RefundStatus; approvedAt: Date | null; processedAt: Date | null }[];
  returns: { id: string; status: ReturnStatus; method: string | null; trackingReference: string | null }[];
  replacements: { id: string; quantity: number; replacementFulfilmentId: string | null }[];
  resolvedAt: Date | null;
};

export type VendorCaseSummary = {
  id: string;
  caseNumber: string;
  status: ResolutionCaseStatus;
  statusLabel: string;
  issueType: ResolutionIssueType;
  fulfilmentId: string | null;
  orderNumber: string;
  createdAt: Date;
};

/** Vendor never sees customer identity/contact/description/conversation — only operational item facts. */
export type VendorCaseDetail = VendorCaseSummary & {
  items: { description: string; quantityAffected: number }[];
};

export type AdminCaseSummary = {
  id: string;
  caseNumber: string;
  status: ResolutionCaseStatus;
  statusLabel: string;
  issueType: ResolutionIssueType;
  orderId: string;
  orderNumber: string;
  customerName: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminCaseDetail = AdminCaseSummary & {
  customerEmail: string;
  customerDescription: string;
  customerSafeDecisionReason: string | null;
  requestedResolution: RequestedResolution | null;
  responsibility: ResolutionResponsibility | null;
  fulfilmentId: string | null;
  items: CaseItemView[];
  affectedVendors: { vendorId: string; vendorName: string; fulfilmentId: string }[];
  attachments: CaseAttachmentView[];
  activities: CaseActivityView[];
  refunds: {
    id: string;
    itemsAmount: number;
    deliveryFeeAmount: number;
    amount: number;
    currency: string;
    status: RefundStatus;
    failureReason: string | null;
    approvedAt: Date | null;
    processedAt: Date | null;
    /** Which provider processed the original Payment — null if no Payment is linked. Controls whether the admin UI offers a mock succeed/fail simulate action or a real "Process refund" + "Check status" flow. */
    paymentProvider: "MOCK" | "MOOLRE" | "PAYSTACK" | null;
    /** The refund executor's own reference for this refund (e.g. Paystack's refund id) — admin diagnostics only. */
    providerReference: string | null;
  }[];
  returns: {
    id: string;
    status: ReturnStatus;
    method: string | null;
    trackingReference: string | null;
    notes: string | null;
    inspectionOutcome: ReturnInspectionOutcome | null;
    restockedAt: Date | null;
  }[];
  replacements: { id: string; originalOrderItemId: string; quantity: number; replacementOrderItemId: string | null; replacementFulfilmentId: string | null }[];
  resolvedAt: Date | null;
  closedAt: Date | null;
};

export type ApproveResolutionInput = {
  items: { caseItemId: string; approvedResolution: ResolutionDecision; approvedRefundAmount?: number; replacementQuantity?: number }[];
  responsibility: ResolutionResponsibility;
  customerSafeDecisionReason: string;
  cancelFulfilmentId?: string;
};
