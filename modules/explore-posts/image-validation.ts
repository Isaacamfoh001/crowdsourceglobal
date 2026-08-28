/**
 * Explore post image validation (M21). Mirrors
 * modules/vendor-listings/image-validation.ts's own allowlist/size-cap/
 * magic-byte approach rather than importing it — the two constraints
 * happen to currently match exactly, but this file is small enough that
 * duplicating it keeps each domain module able to evolve its own limits
 * independently later (the same "three similar lines beats a premature
 * shared abstraction" reasoning that file's own doc comment already
 * documents for its relationship to lib/attachment-validation.ts).
 *
 * MAX is 6 (not 5, like listings) and MIN is 1 — an Explore post without at
 * least one photo isn't a portfolio post at all (CLAUDE.md M21 §4: "1–6
 * images... do not allow an unbounded image array").
 */

export const MIN_EXPLORE_POST_IMAGES = 1;
export const MAX_EXPLORE_POST_IMAGES = 6;
export const MAX_EXPLORE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function sniffMatchesClaimedType(buffer: Buffer, mimeType: string): boolean {
  const magic = {
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "image/jpeg": [0xff, 0xd8, 0xff],
  }[mimeType];

  if (!magic) return true; // webp — no cheap reliable single signature, allowlist-only

  return magic.every((byte, index) => buffer[index] === byte);
}

export function validateExplorePostImage(params: {
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(params.mimeType)) {
    return { ok: false, error: "Images must be PNG, JPEG, or WEBP." };
  }
  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_EXPLORE_IMAGE_SIZE_BYTES) {
    return { ok: false, error: "Each image must be under 5MB." };
  }
  if (!sniffMatchesClaimedType(params.buffer, params.mimeType)) {
    return { ok: false, error: "This file doesn't match its reported image type. Please try a different file." };
  }
  return { ok: true };
}
