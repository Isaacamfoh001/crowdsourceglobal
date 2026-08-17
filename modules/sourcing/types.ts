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
  title: string;
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
  requiredByDate: Date | null;
  customerName: string;
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
  options: AdminSourcingOptionView[];
  allocations: AdminSourcingAllocationView[];
  allocatedTotal: number;
  quotations: QuotationRefView[];
  activities: AdminSourcingActivityView[];
};

export type StaffOption = { id: string; name: string };
export type VendorOption = { id: string; companyName: string };
export type VendorListingOption = { id: string; title: string; vendorId: string; vendorName: string };

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
