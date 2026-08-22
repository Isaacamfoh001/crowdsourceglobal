import { describe, expect, it } from "vitest";
import { listingImageUrl } from "./listing-images";

describe("listingImageUrl", () => {
  it("routes a storage key through the public image endpoint", () => {
    expect(listingImageUrl("vendor-listing-images/abc123.png")).toBe(
      "/api/listings/images/vendor-listing-images%2Fabc123.png",
    );
  });

  it("passes through a pre-M13.1 pasted external URL unchanged, for backward compatibility", () => {
    expect(listingImageUrl("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
    expect(listingImageUrl("http://example.com/photo.jpg")).toBe("http://example.com/photo.jpg");
  });
});
