/**
 * Work-sample image validation (M15). Mirrors modules/vendor-listings/
 * image-validation.ts rather than importing it — same allowlist and size
 * cap, different domain, per CLAUDE.md's "three similar lines beats a
 * premature shared abstraction". Images only, never SVG (no safe rendering
 * guarantee) or the broader sourcing/resolution attachment types (PDF/CSV/
 * XLSX) — work samples are photographs of finished beauty work, nothing else.
 */

export const MIN_WORK_SAMPLES = 3;
export const MAX_WORK_SAMPLES = 8;
export const MAX_WORK_SAMPLE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const WORK_SAMPLE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function sniffMatchesClaimedType(buffer: Buffer, mimeType: string): boolean {
  const magic = {
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "image/jpeg": [0xff, 0xd8, 0xff],
  }[mimeType];

  if (!magic) return true; // webp — no cheap reliable single signature, allowlist-only

  return magic.every((byte, index) => buffer[index] === byte);
}

export function validateWorkSampleImage(params: {
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(params.mimeType)) {
    return { ok: false, error: "Photos must be PNG, JPEG, or WEBP." };
  }
  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_WORK_SAMPLE_SIZE_BYTES) {
    return { ok: false, error: "Each photo must be under 5MB." };
  }
  if (!sniffMatchesClaimedType(params.buffer, params.mimeType)) {
    return { ok: false, error: "This file doesn't match its reported image type. Please try a different photo." };
  }
  return { ok: true };
}
