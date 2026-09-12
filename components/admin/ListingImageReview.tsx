"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { listingImageUrl } from "../../lib/listing-images";
import { explorePostImageUrl } from "../../lib/explore-post-images";

type ListingImageReviewProps = {
  images: string[];
  title: string;
  /**
   * (M21) Which storage-key resolver to render images through — defaults to
   * `listingImageUrl` (VendorListing photos); the Explore-post admin detail
   * page passes `"explore-post"` instead, reusing this entire component/
   * lightbox rather than building a second image-viewer (CLAUDE.md M21 §19:
   * "reuse the good image-review/lightbox pattern... do not create
   * duplicated image-viewer logic unnecessarily").
   *
   * M32.10.2 — this used to accept the resolver function itself
   * (`resolveUrl?: (entry: string) => string`). That's exactly what broke
   * the Explore admin page: a Server Component page (async, no "use
   * client") imported `explorePostImageUrl` and passed the function down as
   * a prop into this Client Component, which Next.js refuses at runtime
   * ("Functions cannot be passed directly to Client Components unless you
   * explicitly expose it by marking it with 'use server'") — the listings
   * page never hit this because it always relied on the default resolver
   * and never passed one across the boundary. Both resolvers
   * (`listingImageUrl`/`explorePostImageUrl`) are pure, dependency-free
   * string builders with no server-only imports, so the fix is to import
   * both directly here and pick between them with a serializable string
   * discriminant instead of ever crossing the boundary with a function.
   */
  imageKind?: "listing" | "explore-post";
  /** Label for the section heading/counts — "Product images" by default, "Post photos" for Explore. */
  label?: string;
};

const RESOLVERS = { listing: listingImageUrl, "explore-post": explorePostImageUrl } as const;

/**
 * Admin moderation image review (M17.1.2, generalized M21). Read-only:
 * renders every image-array entry (resolved via `imageKind`'s resolver, same
 * resolution already used on the corresponding public page — no second
 * image representation) so Admin can inspect content visually before
 * deciding. Primary image + thumbnail grid, click-through to a larger
 * lightbox with prev/next. No mutation, no reorder, no delete.
 */
export function ListingImageReview({ images, title, imageKind = "listing", label = "Product images" }: ListingImageReviewProps) {
  const resolveUrl = RESOLVERS[imageKind];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div>
        <p className="mb-3 text-xs font-semibold tracking-[0.15em] text-espresso-900/50 uppercase">{label}</p>
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-ivory-400 bg-ivory-100 px-5 py-6 text-sm text-espresso-900/60">
          <ImageOff className="size-5 shrink-0 text-ivory-400" strokeWidth={1.5} aria-hidden="true" />
          No images uploaded.
        </div>
      </div>
    );
  }

  const [primary, ...rest] = images;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold tracking-[0.15em] text-espresso-900/50 uppercase">{label}</p>
        <p className="text-xs text-espresso-900/50">
          {images.length} {images.length === 1 ? "image" : "images"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setLightboxIndex(0)}
        aria-label={`View ${title} photo 1 larger`}
        className="block w-full overflow-hidden rounded-lg border border-ivory-300 bg-ivory-200"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed photo, not Next's image optimizer */}
        <img
          src={resolveUrl(primary as string)}
          alt={`${title} photo 1`}
          className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
        />
      </button>

      {rest.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {rest.map((image, index) => (
            <button
              key={image + index}
              type="button"
              onClick={() => setLightboxIndex(index + 1)}
              aria-label={`View ${title} photo ${index + 2} larger`}
              className="overflow-hidden rounded-lg border border-ivory-300 bg-ivory-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed photo, not Next's image optimizer */}
              <img
                src={resolveUrl(image)}
                alt={`${title} photo ${index + 2}`}
                className="aspect-square w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {lightboxIndex !== null ? (
        <ImageLightbox
          images={images}
          title={title}
          index={lightboxIndex}
          resolveUrl={resolveUrl}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </div>
  );
}

function ImageLightbox({
  images,
  title,
  index,
  resolveUrl,
  onIndexChange,
  onClose,
}: {
  images: string[];
  title: string;
  index: number;
  resolveUrl: (entry: string) => string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasMultiple = images.length > 1;

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (hasMultiple && event.key === "ArrowLeft") {
        onIndexChange((index - 1 + images.length) % images.length);
      } else if (hasMultiple && event.key === "ArrowRight") {
        onIndexChange((index + 1) % images.length);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hasMultiple, images.length, index, onClose, onIndexChange]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} photo ${index + 1} of ${images.length}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-espresso-950/80 p-4"
      onClick={onClose}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close image preview"
        className="absolute top-4 right-4 rounded-full bg-ivory-50/10 p-2 text-ivory-50 hover:bg-ivory-50/20"
      >
        <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>

      {hasMultiple ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange((index - 1 + images.length) % images.length);
          }}
          aria-label="Previous image"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-ivory-50/10 p-2 text-ivory-50 hover:bg-ivory-50/20 sm:left-4"
        >
          <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed photo, not Next's image optimizer */}
      <img
        src={resolveUrl(images[index] as string)}
        alt={`${title} photo ${index + 1}`}
        className="max-h-[85vh] max-w-full rounded-lg object-contain"
        onClick={(event) => event.stopPropagation()}
      />

      {hasMultiple ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange((index + 1) % images.length);
          }}
          aria-label="Next image"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-ivory-50/10 p-2 text-ivory-50 hover:bg-ivory-50/20 sm:right-4"
        >
          <ChevronRight className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}

      {hasMultiple ? (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-ivory-50/70">
          {index + 1} / {images.length}
        </p>
      ) : null}
    </div>
  );
}
