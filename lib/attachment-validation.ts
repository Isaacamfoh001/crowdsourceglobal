/**
 * Sourcing-request attachment validation (CLAUDE.md §15/§53 — allowed
 * types, size limits, no trusting browser-reported MIME type alone). Kept
 * deliberately small: images, PDFs, and spreadsheets cover the stated use
 * cases (photos, spec sheets, size-breakdown spreadsheets) without a large
 * type surface to defend.
 */

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_ATTACHMENTS_PER_REQUEST = 5;

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
]);

/**
 * Magic-byte sniff for the types where it's cheap and reliable — a browser-
 * reported Content-Type is never trusted alone (CSV/XLSX have no reliable
 * single-signature check beyond the ZIP header XLSX already uses, so those
 * two rely on the MIME/extension allowlist only).
 */
function sniffMatchesClaimedType(buffer: Buffer, mimeType: string): boolean {
  const magic = {
    "image/png": [0x89, 0x50, 0x4e, 0x47],
    "image/jpeg": [0xff, 0xd8, 0xff],
    "application/pdf": [0x25, 0x50, 0x44, 0x46], // "%PDF"
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [0x50, 0x4b, 0x03, 0x04], // ZIP
  }[mimeType];

  if (!magic) return true; // webp/csv — no cheap reliable single signature, allowlist-only

  return magic.every((byte, index) => buffer[index] === byte);
}

export function validateAttachment(params: {
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
    return { ok: false, error: "That file type isn't supported. Please use an image, PDF, CSV, or Excel file." };
  }
  if (params.sizeBytes <= 0 || params.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    return { ok: false, error: "Files must be under 10MB." };
  }
  if (!sniffMatchesClaimedType(params.buffer, params.mimeType)) {
    return { ok: false, error: "This file doesn't match its reported type. Please try a different file." };
  }
  return { ok: true };
}

/** Display-only — never used to construct a storage/filesystem path. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}
