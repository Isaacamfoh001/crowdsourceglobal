/**
 * Product image validation (M13.1). Deliberately narrower than
 * lib/attachment-validation.ts (sourcing/resolution attachments) — product
 * photos render inline on public marketplace pages, so only real image
 * types are accepted, never PDF/CSV/XLSX, and the size cap is smaller.
 * Mirrors that file's magic-byte-sniff approach rather than importing it,
 * since the allowlists and limits genuinely differ per CLAUDE.md's
 * "three similar lines beats a premature shared abstraction" guidance.
 */

export const MAX_LISTING_IMAGES = 5;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function sniffMatchesClaimedType(buffer: Buffer, mimeType: string): boolean {
  const magic = {
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "image/jpeg": [0xff, 0xd8, 0xff],
  }[mimeType];

  if (!magic) return true; // webp — no cheap reliable single signature, allowlist-only

  return magic.every((byte, index) => buffer[index] === byte);
}

export function validateListingImage(params: {
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(params.mimeType)) {
    return { ok: false, error: "Images must be PNG, JPEG, or WEBP." };
  }
  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false, error: "Each image must be under 5MB." };
  }
  if (!sniffMatchesClaimedType(params.buffer, params.mimeType)) {
    return { ok: false, error: "This file doesn't match its reported image type. Please try a different file." };
  }
  return { ok: true };
}
