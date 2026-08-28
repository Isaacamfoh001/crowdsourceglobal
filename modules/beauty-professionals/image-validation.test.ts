import { describe, expect, it } from "vitest";
import { validateBeautyProfessionalImage, MAX_BEAUTY_PROFESSIONAL_IMAGE_SIZE_BYTES } from "./image-validation";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0]);
const WEBP_BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0]); // RIFF header — webp has no cheap single magic, allowlist-only

describe("validateBeautyProfessionalImage (M22.1 §5)", () => {
  it("accepts a valid PNG", () => {
    const result = validateBeautyProfessionalImage({ mimeType: "image/png", sizeBytes: PNG_MAGIC.length, buffer: PNG_MAGIC });
    expect(result.ok).toBe(true);
  });

  it("accepts a valid JPEG", () => {
    const result = validateBeautyProfessionalImage({ mimeType: "image/jpeg", sizeBytes: JPEG_MAGIC.length, buffer: JPEG_MAGIC });
    expect(result.ok).toBe(true);
  });

  it("accepts WEBP (allowlist-only, no magic-byte check)", () => {
    const result = validateBeautyProfessionalImage({ mimeType: "image/webp", sizeBytes: WEBP_BYTES.length, buffer: WEBP_BYTES });
    expect(result.ok).toBe(true);
  });

  it("rejects a disallowed mime type (e.g. SVG — XSS/script-execution risk if ever rendered inline)", () => {
    const result = validateBeautyProfessionalImage({ mimeType: "image/svg+xml", sizeBytes: 100, buffer: Buffer.from("<svg></svg>") });
    expect(result.ok).toBe(false);
  });

  it("rejects a file over the size cap", () => {
    const oversized = Buffer.alloc(MAX_BEAUTY_PROFESSIONAL_IMAGE_SIZE_BYTES + 1);
    PNG_MAGIC.copy(oversized);
    const result = validateBeautyProfessionalImage({ mimeType: "image/png", sizeBytes: oversized.length, buffer: oversized });
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    const result = validateBeautyProfessionalImage({ mimeType: "image/png", sizeBytes: 0, buffer: Buffer.alloc(0) });
    expect(result.ok).toBe(false);
  });

  it("rejects content whose magic bytes don't match the claimed PNG/JPEG type (spoofed extension/mime)", () => {
    const fakeJpeg = Buffer.from("not actually a jpeg file, just text pretending to be one");
    const result = validateBeautyProfessionalImage({ mimeType: "image/jpeg", sizeBytes: fakeJpeg.length, buffer: fakeJpeg });
    expect(result.ok).toBe(false);
  });
});
