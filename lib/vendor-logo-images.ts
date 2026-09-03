/**
 * Resolves Vendor.logoUrl to a renderable <img src> (M29.1) — mirrors
 * lib/beauty-professional-images.ts's beautyProfessionalImageUrl exactly.
 *
 * Vendor.logoUrl historically held a vendor-pasted external URL (never a
 * storage key). M29.1 replaced the "paste a URL" UX with a real upload
 * through the existing StorageProvider, so the column now holds EITHER:
 *  - a legacy plain http(s):// URL a vendor pasted before this milestone
 *    (kept working forever — never migrated/rewritten), or
 *  - a storage key ("vendor-logo-images/<uuid>.png") from a real upload,
 *    routed through the public, unauthenticated image endpoint below.
 * The column was deliberately NOT renamed — this is a value-format change,
 * not a schema migration, so every existing logo keeps working unchanged.
 */
export function vendorLogoImageUrl(entry: string): string {
  if (entry.startsWith("http://") || entry.startsWith("https://")) {
    return entry;
  }
  return `/api/vendor-logo-images/${encodeURIComponent(entry)}`;
}
