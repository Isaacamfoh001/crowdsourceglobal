/** Public discovery card — never a private Vendor contact field (CLAUDE.md's "no contact bypass" rule applies here too). Internal shape: `heroImage` is a raw storage key, resolved to an absolute URL only at the lib/api/dto layer (mirrors PublicExplorePost.images' own key-vs-resolved-URL split). */
export type PublicBeautyProfessionalSummary = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  heroImage: string | null;
  location: string | null;
  specialties: { id: string; name: string; slug: string }[];
  fromPrice: { amount: string; currency: string } | null;
  createdAt: Date;
};

export type BeautyProfessionalFeedPage = {
  rows: PublicBeautyProfessionalSummary[];
  nextCursor: string | null;
};

export type PublicBeautyServiceSummary = {
  id: string;
  name: string;
  description: string | null;
  startingPrice: { amount: string; currency: string } | null;
  category: { id: string; name: string; slug: string };
};

export type PublicPortfolioItem = {
  id: string;
  images: string[];
  caption: string;
};

export type PublicBeautyProfessionalDetail = PublicBeautyProfessionalSummary & {
  locationMode: string;
  services: PublicBeautyServiceSummary[];
  portfolio: PublicPortfolioItem[];
};

/** A newly-selected file, not-yet-uploaded — see modules/beauty-professionals/image-validation.ts. */
export type ImageFileInput = { buffer: Buffer; filename: string; mimeType: string };

export type ProfileInput = {
  displayName: string;
  bio?: string;
  specialtyCategorySlugs: string[];
  locationMode: "PROVIDER_LOCATION" | "CUSTOMER_LOCATION" | "BOTH";
  /** A newly-selected photo to upload as the hero image. Omit to leave the existing photo (if any) untouched. */
  heroImageFile?: ImageFileInput;
  /** Explicit removal, independent of heroImageFile — set true to clear the existing photo without replacing it. */
  removeHeroImage?: boolean;
};

export type VendorProfileView = {
  id: string;
  status: string;
  displayName: string;
  bio: string | null;
  /** Raw storage key — the vendor-portal form resolves this through beautyProfessionalImageUrl() to render a preview. */
  heroImage: string | null;
  specialtyCategorySlugs: string[];
  locationMode: string;
  changesRequestedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminProfileSummary = {
  id: string;
  displayName: string;
  status: string;
  vendorId: string;
  vendorName: string;
  submittedAt: Date;
  updatedAt: Date;
};

export type AdminProfileDetail = VendorProfileView & {
  vendorId: string;
  vendorName: string;
  submittedAt: Date | null;
};
