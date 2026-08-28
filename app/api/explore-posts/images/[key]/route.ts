import { NextResponse } from "next/server";
import { storageProvider } from "../../../../../lib/storage";

type Params = { key: string };

const IMAGE_KEY_PREFIX = "explore-post-images/";

/** Mirrors app/api/listings/images/[key]/route.ts exactly — see that file's doc comment for the extension-derived Content-Type reasoning. */
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
 * Public Explore-post-image download (M21). Deliberately UNAUTHENTICATED —
 * a PUBLISHED post's photos are public discovery content, meant to be
 * viewable by any visitor, embedded directly in <img src> across the
 * Explore feed. The R2/local bucket itself is never made public — every
 * byte still passes through this app and StorageProvider, never a direct
 * bucket URL. The prefix check keeps this route scoped to Explore-post
 * images only — it can never be used to fetch a vendor-listing/sourcing/
 * resolution attachment key even if one were guessed.
 *
 * Unlike the listing-images route, this does NOT gate on the post's current
 * moderation status — an already-approved image key stays servable even if
 * the post is later archived, same "opaque keys are cheap, never deleted"
 * convention as vendor-listing images (see modules/explore-posts/service.ts's
 * image-cleanup doc comment). A key is never guessable (randomized UUID),
 * so this is not a public listing of unapproved content.
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
