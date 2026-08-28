import { listingImageUrl } from "../listing-images";
import { explorePostImageUrl } from "../explore-post-images";
import { serviceRequestImageUrl } from "../service-request-images";
import { beautyProfessionalImageUrl } from "../beauty-professional-images";
import { env } from "../env";

/**
 * M18.2 — the `/api/v1` equivalent of `lib/listing-images.ts`'s
 * `listingImageUrl()`. A browser resolves a relative `/api/listings/images/…`
 * path against the page's own origin automatically; a native client on a
 * physical phone has no "current page" to resolve it against, so every
 * image reference an `/api/v1` response returns must be an absolute HTTPS
 * URL. This reuses `listingImageUrl()`'s own key-vs-external-URL decision
 * unchanged (so the web app's storage/routing behavior is never
 * duplicated or forked) and only adds the origin prefix for the
 * storage-key case. `env.NEXT_PUBLIC_APP_URL` is already validated as an
 * absolute URL at startup (`lib/env.ts`), so no further validation is
 * needed here.
 */
export function absoluteImageUrl(entry: string): string {
  const resolved = listingImageUrl(entry);
  return resolved.startsWith("/") ? `${env.NEXT_PUBLIC_APP_URL}${resolved}` : resolved;
}

/** Same absolute-URL requirement (M21) — see absoluteImageUrl's doc comment above. */
export function absoluteExplorePostImageUrl(entry: string): string {
  const resolved = explorePostImageUrl(entry);
  return resolved.startsWith("/") ? `${env.NEXT_PUBLIC_APP_URL}${resolved}` : resolved;
}

/** Same absolute-URL requirement (M22) — see absoluteImageUrl's doc comment above. */
export function absoluteServiceRequestImageUrl(entry: string): string {
  const resolved = serviceRequestImageUrl(entry);
  return resolved.startsWith("/") ? `${env.NEXT_PUBLIC_APP_URL}${resolved}` : resolved;
}

/** Same absolute-URL requirement (M22.1) — see absoluteImageUrl's doc comment above. */
export function absoluteBeautyProfessionalImageUrl(entry: string): string {
  const resolved = beautyProfessionalImageUrl(entry);
  return resolved.startsWith("/") ? `${env.NEXT_PUBLIC_APP_URL}${resolved}` : resolved;
}
