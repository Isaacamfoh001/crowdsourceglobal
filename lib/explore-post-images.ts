/**
 * Resolves one ExplorePost.images[] entry to a renderable <img src> (M21) —
 * the Explore-post equivalent of lib/listing-images.ts's `listingImageUrl`.
 * Every key this milestone's upload flow generates is a storage key
 * ("explore-post-images/<uuid>.png"), routed through the public,
 * unauthenticated image endpoint, never a direct bucket URL.
 */
export function explorePostImageUrl(entry: string): string {
  if (entry.startsWith("http://") || entry.startsWith("https://")) {
    return entry;
  }
  return `/api/explore-posts/images/${encodeURIComponent(entry)}`;
}
