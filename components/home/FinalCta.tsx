import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";

export function FinalCta() {
  return (
    <section className="bg-espresso-950 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="grid gap-px overflow-hidden bg-white/5 sm:grid-cols-2">
          <div className="flex flex-col justify-between gap-8 bg-espresso-950 p-10 sm:p-12">
            <div>
              <h3 className="font-display text-2xl font-medium text-ivory-50 sm:text-3xl">
                Ready to buy?
              </h3>
              <p className="mt-3 text-ivory-200/60">
                Create an account to shop, unlock bulk pricing, or request custom sourcing.
              </p>
            </div>
            <Link href="/sign-up" className="inline-flex">
              <Button size="lg" className="!bg-champagne-400 !text-espresso-950 hover:!bg-champagne-300">
                Create your account
                <ArrowRight className="size-4" strokeWidth={2} />
              </Button>
            </Link>
          </div>

          {/* The one restrained burgundy moment on the page — a subtle
              editorial differentiator for the "sell" panel, not a wash of
              color; still reads as part of the same dark family as its
              neighbor. */}
          <div className="flex flex-col justify-between gap-8 bg-burgundy-800 p-10 sm:p-12">
            <div>
              <h3 className="font-display text-2xl font-medium text-ivory-50 sm:text-3xl">
                Ready to sell?
              </h3>
              <p className="mt-3 text-ivory-200/60">
                Become a vendor and let CrownSourceGlobal manage the commerce around your
                products.
              </p>
            </div>
            <Link href="/sell" className="inline-flex">
              <Button
                size="lg"
                variant="outline"
                className="!border-ivory-50/25 !bg-transparent !text-ivory-50 hover:!border-ivory-50/50 hover:!bg-white/5"
              >
                Become a Vendor
                <ArrowRight className="size-4" strokeWidth={2} />
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
