import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "../ui/Button";
import heroImage from "../../app/(public)/images/new wig image.png";

/**
 * Editorial hero (M14.4). Mobile and desktop are two deliberately different
 * compositions sharing one visual panel, not one layout shrunk to fit:
 *
 * - Mobile: the visual panel is a full-width band ABOVE the text (image
 *   leads, text follows), with a vertical gradient fading its bottom edge
 *   into the espresso panel beneath it. A shorter, wider crop (`aspect-[4/3]`)
 *   than desktop keeps most of the four-texture composition in frame rather
 *   than just cropping the desktop image down.
 * - Desktop (`lg:`): the same panel becomes a full-height column to the
 *   RIGHT of the text, with a horizontal gradient fading its left edge into
 *   the text panel — the classic split hero. The tall crop favors the
 *   center of the frame, where hair detail reads best.
 *
 * `heroImage` is a build-time static import (`next/image` + local file) —
 * Next optimizes/resizes it per breakpoint via its built-in image
 * optimizer (sharp is available in this project's dependency tree via
 * `next`, confirmed working). `fill` inside an aspect-ratio-boxed,
 * `position: relative` container reserves layout space before the image
 * loads (no CLS); `priority` skips lazy-loading since this is the largest
 * above-the-fold element (LCP). The container's own dark gradient
 * background is the fallback if the image ever fails to render — it sits
 * *underneath* the `<Image>`, not as competing decoration alongside it.
 */
export function Hero() {
  return (
    <div className="relative bg-espresso-950">
      <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,560px)_1fr] xl:grid-cols-[minmax(0,680px)_1fr] 2xl:grid-cols-[minmax(0,760px)_1fr]">
      {/* <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,560px)_1fr]"> */}
        {/* Visual panel — mobile: top band; desktop: right column. */}
        <div className="relative order-1 aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-forest-900 via-forest-950 to-espresso-950 sm:aspect-[16/9] lg:order-2 lg:aspect-auto">
          <Image
            src={heroImage}
            alt="Four models showing different premium wig and hair textures — sleek balayage, romantic curls, tight curls, and a straight black bob"
            fill
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            placeholder="blur"
            className="object-cover object-[center_28%] lg:object-[center_38%]"
          />

          {/* Mobile fade: bottom edge blends into the text panel below. */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-espresso-950 lg:hidden" />
          {/* Desktop fade: left edge blends into the text panel beside it. */}
          <div className="absolute inset-0 hidden bg-gradient-to-r from-espresso-950 via-espresso-950/15 to-transparent lg:block" />
        </div>

        {/* Text panel */}
        {/* <div className="relative z-10 order-2 flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:order-1 lg:py-28 lg:pr-14 lg:pl-[max(2rem,calc((100vw-1280px)/2+2rem))]"> */}
        <div className="relative z-10 order-2 flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:order-1 lg:py-28 lg:pr-14 lg:pl-[max(2rem,calc((100vw-1280px)/2+2rem))] xl:pr-16 2xl:pr-20">
          <p className="text-xs font-semibold tracking-[0.2em] text-champagne-300 uppercase">
            Global beauty sourcing &amp; commerce
          </p>
          {/* <h1 className="mt-5 font-display text-[2.25rem] leading-[1.05] font-medium tracking-tight text-ivory-50 sm:mt-6 sm:text-6xl lg:text-[3.75rem]"> */}
          <h1 className="mt-5 font-display text-[2.25rem] leading-[1.05] font-medium tracking-tight text-ivory-50 sm:mt-6 sm:text-6xl lg:text-[3.75rem] xl:text-[4.25rem] 2xl:text-[4.75rem]">
            Beauty, sourced
            <br />
            <span className="text-champagne-400">without borders.</span>
          </h1>
          {/* <p className="mt-5 max-w-md text-base leading-relaxed text-ivory-200/70 sm:mt-7 sm:text-lg"> */}
          <p className="mt-5 max-w-md text-base leading-relaxed text-ivory-200/70 sm:mt-7 sm:text-lg xl:max-w-lg 2xl:max-w-xl">
            Discover premium hair, beauty, and cosmetics from approved vendors — or tell
            CrownSourceGlobal what you need and we&apos;ll help connect you with the
            products, suppliers, and manufacturers to source it.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row">
            <Link href="/shop">
              <Button
                size="lg"
                fullWidth
                className="!bg-champagne-400 !text-espresso-950 shadow-none hover:!bg-champagne-300 sm:w-auto"
              >
                Shop beauty
              </Button>
            </Link>
            <Link href="/sourcing">
              <Button
                size="lg"
                variant="outline"
                fullWidth
                className="!border-ivory-50/25 !bg-transparent !text-ivory-50 hover:!border-ivory-50/50 hover:!bg-ivory-50/5 sm:w-auto"
              >
                Source a product
                <ArrowRight className="size-4" strokeWidth={2} />
              </Button>
            </Link>
          </div>

          <div className="mt-9 flex items-center gap-2.5 text-xs font-medium text-ivory-200/60 lg:mt-14">
            <ShieldCheck className="size-4 shrink-0 text-champagne-400" strokeWidth={1.75} />
            Every vendor reviewed before their listings go live
          </div>
        </div>
      </div>
    </div>
  );
}
