import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section } from "../ui/Section";
import { Button } from "../ui/Button";

export function FinalCta() {
  return (
    <Section tone="ink">
      <div className="grid gap-px overflow-hidden rounded-3xl bg-stone-800 sm:grid-cols-2">
        <div className="flex flex-col justify-between gap-8 bg-stone-950 p-10 sm:p-12">
          <div>
            <h3 className="font-display text-2xl font-medium text-white sm:text-3xl">
              Ready to buy?
            </h3>
            <p className="mt-3 text-stone-400">
              Create an account to shop, unlock bulk pricing, or request custom sourcing.
            </p>
          </div>
          <Link href="/sign-up" className="inline-flex">
            <Button size="lg">
              Create your account
              <ArrowRight className="size-4" strokeWidth={2} />
            </Button>
          </Link>
        </div>

        <div className="flex flex-col justify-between gap-8 bg-stone-900 p-10 sm:p-12">
          <div>
            <h3 className="font-display text-2xl font-medium text-white sm:text-3xl">
              Ready to sell?
            </h3>
            <p className="mt-3 text-stone-400">
              Become a vendor and let CrownSourceGlobal manage the commerce around your
              products.
            </p>
          </div>
          <Link href="/sell" className="inline-flex">
            <Button size="lg" variant="outline" className="border-stone-600 bg-transparent">
              Become a Vendor
              <ArrowRight className="size-4" strokeWidth={2} />
            </Button>
          </Link>
        </div>
      </div>
    </Section>
  );
}
