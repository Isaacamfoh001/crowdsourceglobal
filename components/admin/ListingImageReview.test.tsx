import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListingImageReview } from "./ListingImageReview";

afterEach(() => {
  cleanup();
});

describe("ListingImageReview (M17.1.2 — admin listing image review)", () => {
  it("shows an explicit empty state when the listing has zero images", () => {
    render(<ListingImageReview images={[]} title="Test Listing" />);
    expect(screen.getByText("No product images uploaded.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a single image as the primary photo, with no thumbnail grid", () => {
    render(<ListingImageReview images={["vendor-listing-images/one.png"]} title="Test Listing" />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("alt", "Test Listing photo 1");
  });

  it("exposes every uploaded image — primary plus a thumbnail for each remaining one", () => {
    render(
      <ListingImageReview
        images={["vendor-listing-images/a.png", "vendor-listing-images/b.png", "vendor-listing-images/c.png"]}
        title="Test Listing"
      />,
    );
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(screen.getByText("3 product images")).toBeInTheDocument();
  });

  it("opens a larger preview on click and lets the admin step through images without mutating the gallery", () => {
    render(
      <ListingImageReview
        images={["vendor-listing-images/a.png", "vendor-listing-images/b.png"]}
        title="Test Listing"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "View Test Listing photo 1 larger" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Test Listing photo 1 of 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByRole("dialog", { name: "Test Listing photo 2 of 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close image preview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // The underlying gallery is unchanged by opening/closing/navigating the preview.
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("closes the preview on Escape", () => {
    render(<ListingImageReview images={["vendor-listing-images/a.png"]} title="Test Listing" />);
    fireEvent.click(screen.getByRole("button", { name: "View Test Listing photo 1 larger" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
