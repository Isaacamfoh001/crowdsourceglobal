import Link from "next/link";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { ListingCard } from "../catalogue/ListingCard";
import type { PublicListingSummary } from "../../modules/catalogue/types";

export function FeaturedListings({ listings }: { listings: PublicListingSummary[] }) {
  if (listings.length === 0) {
    return null;
  }

  return (
    <section className="bg-ivory-100 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">Curated on CrownSource</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-espresso-950 sm:text-4xl">
              Worth discovering
            </h2>
          </div>
          <Link href="/shop" className="hidden sm:block">
            <Button variant="ghost" className="!text-espresso-950 hover:!bg-espresso-950/5">
              See all listings
            </Button>
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-6">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>

        <div className="mt-8 flex justify-center sm:hidden">
          <Link href="/shop">
            <Button
              variant="outline"
              className="!border-espresso-950/20 !text-espresso-950 hover:!border-espresso-950/40"
            >
              See all listings
            </Button>
          </Link>
        </div>
      </Container>
    </section>
  );
}
