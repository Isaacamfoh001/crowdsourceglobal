"use client";

import { useState } from "react";
import { ListingImagePlaceholder } from "./ListingImagePlaceholder";
import { listingImageUrl } from "../../lib/listing-images";

/**
 * Product detail image display (M13.1). No images → the existing category
 * placeholder, unchanged. One image → a plain single image. Multiple → a
 * large image plus a thumbnail strip that swaps it — deliberately simple
 * (no carousel library, no drag/reorder), per the M13.1 brief.
 */
export function ListingImageGallery({
  images,
  categorySlug,
  title,
}: {
  images: string[];
  categorySlug: string;
  title: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return <ListingImagePlaceholder categorySlug={categorySlug} className="aspect-[4/5]" />;
  }

  const selected = images[Math.min(selectedIndex, images.length - 1)] as string;

  return (
    <div className="flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- served through our own storage-backed route, not Next's image optimizer (no sharp installed — see M13.1 report) */}
      <img
        src={listingImageUrl(selected)}
        alt={title}
        className="aspect-[4/5] w-full bg-ivory-200 object-cover"
      />
      {images.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === selectedIndex}
              className={`size-16 shrink-0 overflow-hidden border-2 ${
                index === selectedIndex ? "border-champagne-500" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail of the same storage-backed image */}
              <img src={listingImageUrl(image)} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
