export type SourcingRequestStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "SOURCING"
  | "AWAITING_CUSTOMER"
  | "QUOTED"
  | "ACCEPTED"
  | "UNABLE_TO_SOURCE"
  | "CANCELLED";

export type SourcingOptionSourceType = "VENDOR_LISTING" | "VENDOR" | "EXTERNAL_SUPPLIER";

export type SourcingRequestInput = {
  /** Optional for a photo-first submission (mobile) — derived from the description/photo when omitted. See submitRequest's doc comment. */
  title?: string;
  /** Required only when no reference image is attached — see submitRequest's doc comment. */
  description: string;
  quantity: number;
  quantityUnit?: string;
  specifications?: Record<string, string>;
  requiredByDate?: Date;
  deliveryCountry: string;
  deliveryRegion?: string;
  deliveryCity?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  categoryId?: string;
};

export type SourcingRequestAttachmentView = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

/** Customer-facing only — never carries options/allocations/internal notes/staff identity. */
export type SourcingRequestSummaryView = {
  id: string;
  requestNumber: string;
  title: string;
  quantity: number;
  quantityUnit: string | null;
  status: SourcingRequestStatus;
  statusLabel: string;
  submittedAt: Date;
  hasQuotation: boolean;
  /** First uploaded attachment, if any — feeds the mobile "My Sourcing Requests" thumbnail (M24). Not necessarily an image; callers check mimeType. */
  primaryAttachment: { id: string; mimeType: string } | null;
};

export type QuotationRefView = {
  id: string;
  reference: string;
  status: string;
  total: number;
  currency: string;
  issuedAt: Date;
};

export type SourcingRequestDetailView = {
  id: string;
  requestNumber: string;
  status: SourcingRequestStatus;
  statusLabel: string;
  title: string;
  description: string;
  quantity: number;
  quantityUnit: string | null;
  specifications: Record<string, string> | null;
  requiredByDate: Date | null;
  deliveryCountry: string;
  deliveryRegion: string | null;
  deliveryCity: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  unableToSourceReason: string | null;
  submittedAt: Date;
  attachments: SourcingRequestAttachmentView[];
  latestQuotation: QuotationRefView | null;
};

// --- Admin/staff-only ------------------------------------------------------

export type AdminSourcingRequestSummaryView = {
  id: string;
  requestNumber: string;
  title: string;
  quantity: number;
  quantityUnit: string | null;
  status: SourcingRequestStatus;
  statusLabel: string;
  submittedAt: Date;
  updatedAt: Date;
  requiredByDate: Date | null;
  customerName: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  hasQuotation: boolean;
};

export type AdminSourcingOptionView = {
  id: string;
  sourceType: SourcingOptionSourceType;
  vendorId: string | null;
  vendorName: string | null;
  vendorListingId: string | null;
  vendorListingTitle: string | null;
  externalSupplierName: string | null;
  externalSupplierContact: string | null;
  quantityAvailable: number | null;
  proposedQuantity: number;
  unitSupplyCost: number;
  currency: string;
  leadTimeDays: number | null;
  originCountry: string | null;
  notes: string | null;
  allocatedQuantity: number;
};

export type AdminSourcingAllocationView = {
  id: string;
  sourcingOptionId: string;
  optionLabel: string;
  allocatedQuantity: number;
  unitSupplyCostSnapshot: number;
  currency: string;
  leadTimeDaysSnapshot: number | null;
  originCountrySnapshot: string | null;
};

export type AdminSourcingActivityView = {
  id: string;
  type: string;
  createdAt: Date;
  actorName: string | null;
  metadata: Record<string, unknown> | null;
};

// --- Factory solicitation (M25.2) -------------------------------------

export type SourcingSolicitationStatus = "SENT" | "RESPONDED" | "CANNOT_FULFIL";

/** Admin's side of a solicitation — one row per factory asked, for the response-comparison view. */
export type AdminSourcingSolicitationView = {
  id: string;
  vendorId: string;
  vendorName: string;
  status: SourcingSolicitationStatus;
  sentAt: Date;
  respondedAt: Date | null;
  proposedQuantity: number | null;
  unitPrice: number | null;
  currency: string;
  leadTimeDays: number | null;
  notes: string | null;
  /** Set once admin has converted this response into a SourcingOption — disables a repeat "Use for quotation" click. */
  convertedToOptionId: string | null;
};

export type AdminSourcingRequestDetailView = {
  id: string;
  requestNumber: string;
  status: SourcingRequestStatus;
  statusLabel: string;
  title: string;
  description: string;
  quantity: number;
  quantityUnit: string | null;
  specifications: Record<string, string> | null;
  requiredByDate: Date | null;
  deliveryCountry: string;
  deliveryRegion: string | null;
  deliveryCity: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  unableToSourceReason: string | null;
  submittedAt: Date;
  attachments: SourcingRequestAttachmentView[];
  customerName: string;
  customerEmail: string;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  solicitations: AdminSourcingSolicitationView[];
  options: AdminSourcingOptionView[];
  allocations: AdminSourcingAllocationView[];
  allocatedTotal: number;
  quotations: QuotationRefView[];
  activities: AdminSourcingActivityView[];
};

export type StaffOption = { id: string; name: string };
export type VendorOption = { id: string; companyName: string };
export type VendorListingOption = { id: string; title: string; vendorId: string; vendorName: string };

/** A quote-pricing suggestion computed server-side (Decimal) from a chosen SourcingOption — a prefill default, never trusted if echoed back by a client. */
export type QuotePricingSuggestion = {
  factoryUnitPrice: number;
  factoryQuantity: number;
  factorySubtotal: number;
  markupPercent: number;
  customerUnitPrice: number;
  customerSubtotal: number;
  currency: string;
};

// --- Factory (vendor) portal views --------------------------------------

/** Factory's queue entry — never carries customer identity/contact. */
export type VendorSolicitationSummaryView = {
  id: string;
  status: SourcingSolicitationStatus;
  sentAt: Date;
  requestReference: string;
  requestTitle: string;
  quantity: number;
  quantityUnit: string | null;
};

/** Factory's detail view of one solicitation — the request fields a factory legitimately needs, and nothing else. */
export type VendorSolicitationDetailView = {
  id: string;
  status: SourcingSolicitationStatus;
  sentAt: Date;
  respondedAt: Date | null;
  requestReference: string;
  title: string;
  description: string;
  quantity: number;
  quantityUnit: string | null;
  specifications: Record<string, string> | null;
  deliveryCountry: string;
  deliveryRegion: string | null;
  deliveryCity: string | null;
  requiredByDate: Date | null;
  attachments: SourcingRequestAttachmentView[];
  response: {
    proposedQuantity: number | null;
    unitPrice: number | null;
    currency: string;
    leadTimeDays: number | null;
    notes: string | null;
  } | null;
};

export type RespondToSolicitationInput =
  | { canFulfil: false }
  | { canFulfil: true; proposedQuantity: number; unitPrice: number; leadTimeDays?: number; notes?: string };

export type AddSourcingOptionInput = {
  sourceType: SourcingOptionSourceType;
  vendorId?: string;
  vendorListingId?: string;
  externalSupplierName?: string;
  externalSupplierContact?: string;
  quantityAvailable?: number;
  proposedQuantity: number;
  unitSupplyCost: number;
  currency?: string;
  leadTimeDays?: number;
  originCountry?: string;
  notes?: string;
};

export type SetAllocationsInput = {
  sourcingOptionId: string;
  allocatedQuantity: number;
}[];

export type PrepareQuoteInput = {
  description: string;
  unitPrice: number;
  otherInternalCosts?: number;
};
