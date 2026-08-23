import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "../ui/Button";
import { listingImageUrl } from "../../lib/listing-images";
import type { PublicListingSummary } from "../../modules/catalogue/types";

/**
 * Editorial full-bleed hero (M14.3). The photograph is a real panel of the
 * layout — bleeding to the viewport's right edge and blending into the
 * espresso text panel via a gradient, not a photo dropped inside a rounded
 * card. Desktop only; mobile stays a compact text-first hero with a slim
 * two-image strip instead of a full illustration, so it never eats more
 * than a fraction of the first screen.
 */
export function Hero({ featuredListings }: { featuredListings: PublicListingSummary[] }) {
  const images = featuredListings.filter((l): l is typeof l & { primaryImage: string } => Boolean(l.primaryImage));
  const hero = images[0];
  const detail = images[1];
  const mobileStrip = images.slice(0, 3);

  return (
    <div className="relative bg-espresso-950">
      <div className="grid lg:grid-cols-[minmax(0,560px)_1fr]">
        <div className="relative z-10 flex flex-col justify-center px-6 py-14 sm:px-10 sm:py-20 lg:py-28 lg:pr-14 lg:pl-[max(2rem,calc((100vw-1280px)/2+2rem))]">
          <p className="text-xs font-semibold tracking-[0.2em] text-champagne-300 uppercase">
            A managed marketplace
          </p>
          <h1 className="mt-5 font-display text-[2.5rem] leading-[1.05] font-medium tracking-tight text-ivory-50 sm:mt-6 sm:text-6xl lg:text-[3.75rem]">
            Buy what you need,
            <br />
            <span className="text-champagne-400">however you need it.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ivory-200/70 sm:mt-7 sm:text-lg">
            Shop individual products, unlock instant pricing on bulk orders, or tell us
            what you&apos;re sourcing and we&apos;ll find it — every vendor reviewed before
            their listings go live.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row">
            <Link href="/shop">
              <Button
                size="lg"
                fullWidth
                className="!bg-champagne-400 !text-espresso-950 shadow-none hover:!bg-champagne-300 sm:w-auto"
              >
                Shop the marketplace
              </Button>
            </Link>
            <Link href="/sourcing">
              <Button
                size="lg"
                variant="outline"
                fullWidth
                className="!border-ivory-50/25 !bg-transparent !text-ivory-50 hover:!border-ivory-50/50 hover:!bg-white/5 sm:w-auto"
              >
                Source an item
                <ArrowRight className="size-4" strokeWidth={2} />
              </Button>
            </Link>
          </div>

          <div className="mt-9 flex items-center gap-2.5 text-xs font-medium text-ivory-200/60 lg:mt-14">
            <ShieldCheck className="size-4 shrink-0 text-champagne-400" strokeWidth={1.75} />
            Every vendor reviewed before their listings go live
          </div>

          {/* Compact mobile-only texture — a slim image strip rather than
              the desktop's full photographic panel, so mobile stays
              text-first and the hero never spans multiple screens. */}
          {mobileStrip.length > 0 ? (
            <div className="mt-8 flex gap-2.5 lg:hidden" aria-hidden="true">
              {mobileStrip.map((listing) => (
                <div key={listing.id} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed product photo */}
                  <img
                    src={listingImageUrl(listing.primaryImage)}
                    alt=""
                    className="size-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Full-bleed photographic panel — desktop only. */}
        <div className="relative hidden overflow-hidden lg:block">
          {hero ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed product photo */}
              <img
                src={listingImageUrl(hero.primaryImage)}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-espresso-950 via-espresso-950/10 to-transparent" />
              {detail ? (
                <div className="absolute bottom-10 right-10 w-40 overflow-hidden rounded-lg shadow-2xl ring-1 ring-ivory-50/10 xl:w-52">
                  {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed product photo */}
                  <img
                    src={listingImageUrl(detail.primaryImage)}
                    alt=""
                    className="aspect-[4/5] w-full object-cover"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex size-full items-center justify-center bg-gradient-to-br from-forest-950 to-espresso-950">
              <p className="rotate-[-6deg] font-display text-[9rem] font-medium text-white/[0.04] select-none">
                CSG
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
