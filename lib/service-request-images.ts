/**
 * Resolves one ServiceRequest.referenceImage entry to a renderable <img src>
 * (M22) — mirrors lib/explore-post-images.ts's explorePostImageUrl exactly.
 */
export function serviceRequestImageUrl(entry: string): string {
  if (entry.startsWith("http://") || entry.startsWith("https://")) {
    return entry;
  }
  return `/api/service-requests/images/${encodeURIComponent(entry)}`;
}
