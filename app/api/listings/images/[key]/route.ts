import { NextResponse } from "next/server";
import { storageProvider } from "../../../../../lib/storage";

type Params = { key: string };

const IMAGE_KEY_PREFIX = "vendor-listing-images/";

/**
 * Content-Type is derived from the key's own extension, not from
 * `object.contentType` — LocalDiskStorageProvider (lib/storage.ts) never
 * persists a real content type (it only exists for dev/test, and has no
 * DB-backed mimeType column to fall back on the way sourcing/resolution
 * attachments do). modules/vendor-listings/service.ts always generates
 * keys with one of these extensions (see extensionForMimeType), so this is
 * exhaustive for every key this route will ever be asked to serve.
 */
const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

function contentTypeForKey(key: string): string {
  const dot = key.lastIndexOf(".");
  const extension = dot === -1 ? "" : key.slice(dot);
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/**
 * Public product-image download (M13.1). Unlike
 * app/api/sourcing/attachments and app/api/resolutions/attachments, this is
 * deliberately UNAUTHENTICATED — product photos are public marketplace
 * content, meant to be viewable by any shopper, embedded directly in
 * <img src> across the public catalogue. What stays deliberate: the R2/
 * local bucket itself is never made public (CLAUDE.md §15/M13 storage
 * architecture) — every byte still passes through this app and
 * StorageProvider, never a direct bucket URL. The prefix check keeps this
 * route scoped to product images only — it can never be used to fetch a
 * sourcing/resolution attachment key even if one were guessed.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);

  if (!key.startsWith(IMAGE_KEY_PREFIX)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const object = await storageProvider.readObject(key);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(object.buffer), {
    headers: {
      "Content-Type": contentTypeForKey(key),
      // Keys are opaque and never reused/overwritten after upload (M13.1
      // report — removed images are never deleted from storage, only
      // dereferenced), so a long-lived public cache is safe.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
