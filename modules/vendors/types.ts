export type PublicVendorProfile = {
  id: string;
  companyName: string;
  description: string | null;
  storefrontSlug: string;
  sellerType: string | null;
  logoUrl: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  categorySlugs: string[];
};

export type VendorMembershipRole = "OWNER" | "STAFF";

export type VendorPortalContext = {
  vendorId: string;
  role: VendorMembershipRole;
  vendor: {
    id: string;
    companyName: string;
    storefrontSlug: string;
    verificationStatus: string;
  };
};

/** Private store-settings view — never exposed on any public DTO. */
export type VendorStoreProfile = {
  id: string;
  companyName: string;
  description: string | null;
  storefrontSlug: string;
  sellerType: string | null;
  logoUrl: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  categorySlugs: string[];
  contactEmail: string | null;
  contactPhone: string | null;
  leadTimeDaysDefault: number | null;
};

export type StoreProfileInput = {
  companyName: string;
  description?: string;
  logoUrl?: string;
  country?: string;
  region?: string;
  city?: string;
  categorySlugs: string[];
  contactEmail?: string;
  contactPhone?: string;
  leadTimeDaysDefault?: number;
};
