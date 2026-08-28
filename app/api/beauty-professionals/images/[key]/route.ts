import { NextResponse } from "next/server";
import { storageProvider } from "../../../../../lib/storage";

type Params = { key: string };

const IMAGE_KEY_PREFIX = "beauty-professional-images/";

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
 * Public Beauty Professional hero-image download (M22.1). Deliberately
 * unauthenticated, same convention as the listing/explore-post image
 * routes — a public profile's hero photo is meant to be viewable by any
 * visitor. The R2/local bucket itself is never public; every byte still
 * passes through StorageProvider, and a key is never guessable (randomized
 * UUID). The prefix check scopes this route to Beauty Professional hero
 * images only.
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
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
