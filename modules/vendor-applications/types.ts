export const SELLER_TYPES = [
  {
    value: "INDIVIDUAL",
    label: "Individual / Independent Seller",
    description: "You sell on your own, without a registered business.",
  },
  {
    value: "SOLE_TRADER",
    label: "Entrepreneur / Sole Trader",
    description: "You run a small operation, registered or not.",
  },
  {
    value: "REGISTERED_BUSINESS",
    label: "Registered Business / Company",
    description: "An incorporated or formally registered company.",
  },
  {
    value: "DISTRIBUTOR_WHOLESALER",
    label: "Distributor / Wholesaler",
    description: "You supply other businesses in bulk.",
  },
  {
    value: "MANUFACTURER",
    label: "Manufacturer",
    description: "You produce the goods you sell.",
  },
  {
    value: "ORGANIZATION",
    label: "Organization / Institution",
    description: "A cooperative, NGO, or other institution.",
  },
  { value: "OTHER", label: "Other", description: "None of the above quite fits." },
] as const;

export type SellerType = (typeof SELLER_TYPES)[number]["value"];

/** Seller types for which business-registration fields are meaningfully askable. */
export const REGISTRATION_RELEVANT_SELLER_TYPES: SellerType[] = [
  "REGISTERED_BUSINESS",
  "DISTRIBUTOR_WHOLESALER",
  "MANUFACTURER",
  "ORGANIZATION",
];

export type VendorApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED";

/** Statuses in which the applicant may still edit their application. */
export const EDITABLE_STATUSES: VendorApplicationStatus[] = ["DRAFT", "CHANGES_REQUESTED", "REJECTED"];

export type VendorApplicationView = {
  id: string;
  status: VendorApplicationStatus;
  sellerType: SellerType | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  displayName: string | null;
  legalName: string | null;
  storeDescription: string | null;
  registrationNumber: string | null;
  taxIdentifier: string | null;
  yearEstablished: number | null;
  websiteUrl: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  addressLine1: string | null;
  categorySlugs: string[];
  sellingMode: string | null;
  bulkCapable: boolean;
  leadTimeDaysDefault: number | null;
  serviceAreas: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  decisionReason: string | null;
  vendorId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SellerTypeStepInput = { sellerType: SellerType };

export type ContactStepInput = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export type BusinessStepInput = {
  displayName: string;
  legalName?: string;
  storeDescription: string;
  registrationNumber?: string;
  taxIdentifier?: string;
  yearEstablished?: number;
  websiteUrl?: string;
  country: string;
  region: string;
  city: string;
  addressLine1: string;
};

export type OperationsStepInput = {
  categorySlugs: string[];
  sellingMode: string;
  bulkCapable: boolean;
  leadTimeDaysDefault?: number;
  serviceAreas?: string;
};

export type AdminApplicationSummary = {
  id: string;
  status: VendorApplicationStatus;
  displayName: string | null;
  sellerType: SellerType | null;
  applicantName: string;
  applicantEmail: string;
  submittedAt: Date | null;
  createdAt: Date;
};
