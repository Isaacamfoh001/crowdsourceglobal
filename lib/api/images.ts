import { listingImageUrl } from "../listing-images";
import { explorePostImageUrl } from "../explore-post-images";
import { serviceRequestImageUrl } from "../service-request-images";
import { beautyProfessionalImageUrl } from "../beauty-professional-images";
import { vendorLogoImageUrl } from "../vendor-logo-images";

/**
 * M18.2 — the `/api/v1` equivalent of `lib/listing-images.ts`'s
 * `listingImageUrl()`.
 *
 * Deliberately RELATIVE (M32.11 fix — the same correction
 * `sourcingAttachmentUrl` below already got in M32.10.3). This used to be
 * prefixed with `env.NEXT_PUBLIC_APP_URL`, on the theory that a native
 * client has no "current page" to resolve a relative path against, so
 * every `/api/v1` image reference needed to be an absolute URL. That
 * reasoning missed that `NEXT_PUBLIC_APP_URL` is this SERVER's own
 * configured origin, not necessarily a host a given client can actually
 * reach: in local development it's `http://localhost:3000`, which
 * resolves fine in a browser (same machine) but points a physical phone
 * at itself — the exact "picture never loads" bug M32.10.3 found on
 * sourcing attachments, found again in M32.11 on listing/Explore/Beauty/
 * vendor-logo images. The mobile app already resolves every other
 * `/api/v1/*` image path against its own independently-configured,
 * actually-reachable API base (`EXPO_PUBLIC_API_BASE_URL`, see the mobile
 * repo's `lib/api/client.ts`'s `resolvePublicMediaUrl`) — this returns the
 * same relative shape `sourcingAttachmentUrl` does and lets the client do
 * that resolution, rather than trusting this server's self-reported
 * origin. Unlike sourcing attachments, these routes are public/
 * unauthenticated (see their route handlers), so the mobile client needs
 * no session cookie to fetch the resolved URL — a bare `{ uri }`
 * `expo-image` source is enough, no `fetchAuthenticatedBinary`/local-file
 * dance required.
 *
 * Still reuses `listingImageUrl()`'s own key-vs-external-URL decision
 * unchanged (so the web app's storage/routing behavior is never
 * duplicated or forked) — a legacy pasted `http(s)://` URL is returned
 * as-is, exactly as before, since it is already reachable from anywhere.
 */
export function absoluteImageUrl(entry: string): string {
  return listingImageUrl(entry);
}

/** Same relative-path convention (M21/M32.11) — see absoluteImageUrl's doc comment above. */
export function absoluteExplorePostImageUrl(entry: string): string {
  return explorePostImageUrl(entry);
}

/** Same relative-path convention (M22/M32.11) — see absoluteImageUrl's doc comment above. */
export function absoluteServiceRequestImageUrl(entry: string): string {
  return serviceRequestImageUrl(entry);
}

/** Same relative-path convention (M22.1/M32.11) — see absoluteImageUrl's doc comment above. */
export function absoluteBeautyProfessionalImageUrl(entry: string): string {
  return beautyProfessionalImageUrl(entry);
}

/** Same relative-path convention (M29.1/M32.11) — see absoluteImageUrl's doc comment above. Handles both a legacy pasted URL and a real uploaded storage key — see vendor-logo-images.ts. */
export function absoluteVendorLogoUrl(entry: string): string {
  return vendorLogoImageUrl(entry);
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
