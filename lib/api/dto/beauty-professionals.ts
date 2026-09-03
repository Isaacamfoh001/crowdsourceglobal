import { absoluteExplorePostImageUrl, absoluteBeautyProfessionalImageUrl, absoluteVendorLogoUrl } from "../images";
import { serializeDate } from "../response";
import type { PublicBeautyProfessionalDetail, PublicBeautyProfessionalSummary } from "../../../modules/beauty-professionals/types";

/**
 * M22 — shared DTO mapper for the public Beauty Services discovery API,
 * same convention as lib/api/dto/explore-posts.ts: no raw Prisma row, no
 * private Vendor contact field, no fabricated rating/review/badge data
 * (CLAUDE.md's "no fake ratings/reviews/badges unless backed by real
 * persisted data" — there is none in M22).
 *
 * `heroImage` (a raw storage key internally — M22.1) is resolved to an
 * absolute URL here, the one place the key-vs-URL boundary is crossed, same
 * pattern as portfolio.images below.
 */
export function toBeautyProfessionalSummaryDTO(profile: PublicBeautyProfessionalSummary) {
  return {
    id: profile.id,
    displayName: profile.displayName,
    bio: profile.bio,
    // avatarUrl (Vendor.logoUrl) holds either a legacy pasted URL or a real
    // uploaded storage key (M29.1) — absoluteVendorLogoUrl resolves either.
    avatarUrl: profile.avatarUrl ? absoluteVendorLogoUrl(profile.avatarUrl) : null,
    heroImageUrl: profile.heroImage ? absoluteBeautyProfessionalImageUrl(profile.heroImage) : null,
    location: profile.location,
    specialties: profile.specialties,
    fromPrice: profile.fromPrice,
    createdAt: serializeDate(profile.createdAt),
  };
}

export function toBeautyProfessionalDetailDTO(profile: PublicBeautyProfessionalDetail) {
  return {
    ...toBeautyProfessionalSummaryDTO(profile),
    locationMode: profile.locationMode,
    services: profile.services,
    portfolio: profile.portfolio.map((post) => ({ id: post.id, caption: post.caption, images: post.images.map(absoluteExplorePostImageUrl) })),
  };
}
