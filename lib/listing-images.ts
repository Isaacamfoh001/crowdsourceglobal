/**
 * Resolves one VendorListing.images[] entry to a renderable <img src>
 * (M13.1). Handles both shapes that can exist in that field:
 * - a storage key this milestone's upload flow generated
 *   ("vendor-listing-images/<uuid>.png") — routed through the public,
 *   unauthenticated image endpoint, never a direct bucket URL;
 * - a full external URL a vendor pasted before this milestone (the
 *   previous "Image URLs" textarea) — rendered as-is, so existing listings
 *   keep working without any data migration.
 */
export function listingImageUrl(entry: string): string {
  if (entry.startsWith("http://") || entry.startsWith("https://")) {
    return entry;
  }
  return `/api/listings/images/${encodeURIComponent(entry)}`;
}
