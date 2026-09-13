export type BulkTierInput = {
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
};

export type ListingFormInput = {
  title: string;
  description: string;
  categoryId: string;
  /** M32.5 — free-text label when categoryId is the shared "Other / Not listed" placeholder Category. Null/undefined otherwise. */
  categoryOther?: string | null;
  basePrice: number;
  moq: number;
  maxOq?: number | null;
  leadTimeDays?: number | null;
  images: string[];
  specs?: Record<string, string> | null;
};

export type PendingChangesPayload = {
  listing: ListingFormInput;
  bulkPriceTiers: BulkTierInput[];
};

export type VendorListingSummary = {
  id: string;
  title: string;
  basePrice: number;
  currency: string;
  approvalStatus: string;
  listingStatus: string;
  availabilityStatus: string;
  availableQuantity: number;
  hasPendingChanges: boolean;
  changesRequestedReason: string | null;
  updatedAt: Date;
  /** M32.11 — raw storage key/legacy URL of the first image, or null if the listing has none yet; resolved to a URL only in the DTO layer (toVendorListingSummaryDTO). Only findSummariesForVendorPaginated (the mobile/vendor-portal listings list) selects `images` to compute this — see that method's own doc comment. */
  primaryImage: string | null;
};

export type VendorListingDetail = {
  id: string;
  title: string;
  description: string;
  images: string[];
  specs: Record<string, string> | null;
  basePrice: number;
  currency: string;
  moq: number;
  maxOq: number | null;
  leadTimeDays: number | null;
  availableQuantity: number;
  availabilityStatus: string;
  approvalStatus: string;
  listingStatus: string;
  submittedAt: Date | null;
  changesRequestedReason: string | null;
  categoryId: string;
  categoryOther: string | null;
  bulkPriceTiers: { id: string; minQuantity: number; maxQuantity: number | null; unitPrice: number }[];
  pendingChanges: PendingChangesPayload | null;
};

export type AdminListingSummary = {
  id: string;
  title: string;
  basePrice: number;
  currency: string;
  approvalStatus: string;
  listingStatus: string;
  isEdit: boolean;
  vendorName: string;
  vendorId: string;
  submittedAt: Date;
  updatedAt: Date;
};

export type AdminListingDetail = VendorListingDetail & {
  vendorId: string;
  vendorName: string;
};
