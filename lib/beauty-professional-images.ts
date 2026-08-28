/**
 * Resolves BeautyProfessionalProfile.heroImage to a renderable <img src>
 * (M22.1) — mirrors lib/explore-post-images.ts's explorePostImageUrl
 * exactly. Every key this milestone's upload flow generates is a storage
 * key ("beauty-professional-images/<uuid>.png"), routed through the
 * public, unauthenticated image endpoint, never a direct bucket URL.
 */
export function beautyProfessionalImageUrl(entry: string): string {
  if (entry.startsWith("http://") || entry.startsWith("https://")) {
    return entry;
  }
  return `/api/beauty-professionals/images/${encodeURIComponent(entry)}`;
}
