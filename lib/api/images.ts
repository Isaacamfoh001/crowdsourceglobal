import { listingImageUrl } from "../listing-images";
import { explorePostImageUrl } from "../explore-post-images";
import { serviceRequestImageUrl } from "../service-request-images";
import { beautyProfessionalImageUrl } from "../beauty-professional-images";
import { vendorLogoImageUrl } from "../vendor-logo-images";
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

/** Same absolute-URL requirement (M29.1) — see absoluteImageUrl's doc comment above. Handles both a legacy pasted URL and a real uploaded storage key — see vendor-logo-images.ts. */
export function absoluteVendorLogoUrl(entry: string): string {
  const resolved = vendorLogoImageUrl(entry);
  return resolved.startsWith("/") ? `${env.NEXT_PUBLIC_APP_URL}${resolved}` : resolved;
}

/**
 * Sourcing-request attachment path (M24). Unlike the other image helpers
 * above, this points at the EXISTING private, session-authenticated
 * download route (app/api/sourcing/attachments/[id]/route.ts) — sourcing
 * attachments can include non-image documents and were deliberately kept
 * private (owning customer or staff only), never the unauthenticated-but-
 * unguessable-key convention the other media types use.
 *
 * Deliberately RELATIVE (M32.10.3 fix) — this used to be prefixed with
 * `env.NEXT_PUBLIC_APP_URL`, on the theory (correct for the OTHER helpers
 * above) that a native client has no "current page" to resolve a relative
 * path against. But `NEXT_PUBLIC_APP_URL` is this SERVER's own configured
 * origin, which is not necessarily the host a given client can actually
 * reach: in local development it's `http://localhost:3000`, which resolves
 * fine in a browser (same machine) but points a physical phone at itself.
 * The mobile app already resolves every other `/api/v1/*` call against its
 * own independently-configured, actually-reachable API base
 * (`EXPO_PUBLIC_API_BASE_URL`, see the mobile repo's `lib/api/client.ts` /
 * `fetchAuthenticatedBinary`) — this path does the same, exactly like
 * `components/sourcing/AttachmentGallery.tsx`'s admin-web `<img>` already
 * does by using this same relative path directly. A native client must
 * still attach its session cookie itself when fetching it.
 */
export function sourcingAttachmentUrl(attachmentId: string): string {
  return `/api/sourcing/attachments/${attachmentId}`;
}

/**
 * Resolution-case evidence attachment path (M26). Same private,
 * session-authenticated-route, relative-path convention as
 * sourcingAttachmentUrl above (app/api/resolutions/attachments/[id]/route.ts)
 * — owning customer or staff only, never the unauthenticated-but-unguessable-
 * key convention.
 */
export function resolutionAttachmentUrl(attachmentId: string): string {
  return `/api/resolutions/attachments/${attachmentId}`;
}
