import Link from "next/link";
import { Section } from "../ui/Section";
import { SectionHeading } from "../ui/SectionHeading";
import { Button } from "../ui/Button";
import { ListingCard } from "../catalogue/ListingCard";
import type { PublicListingSummary } from "../../modules/catalogue/types";

export function FeaturedListings({ listings }: { listings: PublicListingSummary[] }) {
  if (listings.length === 0) {
    return null;
  }

  return (
    <Section tone="muted">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading eyebrow="Recently added" title="Listings from our vendors" />
        <Link href="/shop" className="hidden sm:block">
          <Button variant="ghost">See all listings</Button>
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      <div className="mt-8 flex justify-center sm:hidden">
        <Link href="/shop">
          <Button variant="outline">See all listings</Button>
        </Link>
      </div>
    </Section>
  );
}
