/**
 * Service-request reference/inspiration photo validation (M22). Same
 * allowlist/size-cap/magic-byte approach as
 * modules/explore-posts/image-validation.ts, deliberately duplicated rather
 * than shared (see that file's doc comment for the reasoning) — bounded to
 * exactly one optional image, not 1-6, since this is request context, not a
 * portfolio post.
 */

export const MAX_SERVICE_REQUEST_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function sniffMatchesClaimedType(buffer: Buffer, mimeType: string): boolean {
  const magic = {
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "image/jpeg": [0xff, 0xd8, 0xff],
  }[mimeType];

  if (!magic) return true; // webp — no cheap reliable single signature, allowlist-only

  return magic.every((byte, index) => buffer[index] === byte);
}

export function validateServiceRequestImage(params: {
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(params.mimeType)) {
    return { ok: false, error: "The reference image must be PNG, JPEG, or WEBP." };
  }
  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_SERVICE_REQUEST_IMAGE_SIZE_BYTES) {
    return { ok: false, error: "The reference image must be under 5MB." };
  }
  if (!sniffMatchesClaimedType(params.buffer, params.mimeType)) {
    return { ok: false, error: "This file doesn't match its reported image type. Please try a different file." };
  }
  return { ok: true };
}
