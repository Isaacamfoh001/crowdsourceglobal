import { NextResponse } from "next/server";
import { storageProvider } from "../../../../../lib/storage";

type Params = { key: string };

const IMAGE_KEY_PREFIX = "service-request-images/";

/** Mirrors app/api/explore-posts/images/[key]/route.ts exactly — same extension-derived Content-Type and unauthenticated-but-unguessable-key convention. */
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
 * Reference/inspiration photo download for a ServiceRequest (M22).
 * Deliberately unauthenticated, same convention as the listing/explore-post
 * image routes it mirrors — the R2/local bucket itself is never public,
 * every byte still passes through StorageProvider, and a key is never
 * guessable (randomized UUID). The prefix check keeps this route scoped to
 * service-request images only.
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
      "Cache-Control": "private, max-age=86400",
    },
  });
}
