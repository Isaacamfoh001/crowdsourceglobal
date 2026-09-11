import type { VendorApplicationStatus } from "../vendor-applications/types";

export type { VendorApplicationStatus };

export type ManufacturerApplicationView = {
  id: string;
  status: VendorApplicationStatus;
  categorySlugs: string[];
  categoryOther: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  decisionReason: string | null;
  vendorId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryStepInput = {
  categorySlugs: string[];
  /** Free-text "what do you manufacture?" — required (and only meaningful) when categorySlugs is empty. */
  categoryOther?: string | null;
};

export type AdminManufacturerApplicationSummary = {
  id: string;
  status: VendorApplicationStatus;
  categorySlugs: string[];
  categoryOther: string | null;
  vendorId: string;
  vendorName: string;
  /** The Vendor's existing, unchanged classification — shown so admin can see what this Vendor already is before granting the additional Manufacturer capability. */
  vendorSellerType: string | null;
  submittedAt: Date | null;
  createdAt: Date;
};
