import { absoluteExplorePostImageUrl, absoluteVendorLogoUrl } from "../images";
import { serializeDate } from "../response";
import type { PublicExplorePost } from "../../../modules/explore-posts/types";

/**
 * M21 — shared DTO mapper for the public Explore feed API, following the
 * exact same convention as lib/api/dto/catalogue.ts: no raw Prisma row, no
 * internal/moderation-only field, engagement (likedByMe/savedByMe) computed
 * outside this function and passed in explicitly since it depends on the
 * viewer, not the post itself.
 */
export function toExplorePostDTO(
  post: PublicExplorePost,
  engagement: { likedByMe: boolean; savedByMe: boolean },
) {
  const location = [post.vendor.city, post.vendor.region, post.vendor.country].filter(Boolean).join(", ") || null;

  return {
    id: post.id,
    caption: post.caption,
    images: post.images.map(absoluteExplorePostImageUrl),
    category: post.category,
    location,
    createdAt: serializeDate(post.createdAt),
    publisher: {
      id: post.vendor.id,
      name: post.vendor.companyName,
      // Vendor.logoUrl holds either a legacy pasted URL or a real uploaded
      // storage key (M29.1) — absoluteVendorLogoUrl resolves either case.
      avatarUrl: post.vendor.logoUrl ? absoluteVendorLogoUrl(post.vendor.logoUrl) : null,
      storefrontSlug: post.vendor.storefrontSlug,
    },
    engagement: {
      likedByMe: engagement.likedByMe,
      savedByMe: engagement.savedByMe,
      likeCount: post.likeCount,
    },
  };
}
