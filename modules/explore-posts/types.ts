export type ExplorePostPendingChangesPayload = {
  caption: string;
  categoryId: string;
  images: string[];
};

/** Public feed/detail shape — never exposes vendorId's private fields, moderation-internal data, or another user's engagement. */
export type PublicExplorePost = {
  id: string;
  caption: string;
  images: string[];
  createdAt: Date;
  category: { id: string; name: string; slug: string };
  vendor: {
    id: string;
    companyName: string;
    logoUrl: string | null;
    storefrontSlug: string;
    country: string | null;
    region: string | null;
    city: string | null;
  };
  likeCount: number;
};

export type ExplorePostFeedPage = {
  rows: PublicExplorePost[];
  nextCursor: string | null;
};

export type VendorExplorePostSummary = {
  id: string;
  caption: string;
  images: string[];
  approvalStatus: string;
  visibility: string;
  hasPendingChanges: boolean;
  changesRequestedReason: string | null;
  categoryId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminExplorePostSummary = {
  id: string;
  caption: string;
  approvalStatus: string;
  visibility: string;
  isEdit: boolean;
  vendorName: string;
  vendorId: string;
  submittedAt: Date;
  updatedAt: Date;
};

export type AdminExplorePostDetail = {
  id: string;
  caption: string;
  images: string[];
  approvalStatus: string;
  visibility: string;
  categoryId: string;
  category: { id: string; name: string };
  pendingChanges: ExplorePostPendingChangesPayload | null;
  vendorId: string;
  vendorName: string;
  submittedAt: Date | null;
};
