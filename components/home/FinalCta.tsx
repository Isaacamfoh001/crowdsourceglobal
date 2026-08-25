import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";

/**
 * Single restrained closer (M14.4) — replaces the previous two-panel dark
 * espresso/burgundy split. One statement, one primary action, a quiet
 * secondary link; the page has already made its dark-moment case in the
 * hero and the sourcing section, so the footer approach doesn't need a
 * third and fourth.
 */
export function FinalCta() {
  return (
    <section className="border-t border-ivory-300 bg-ivory-100 py-16 sm:py-20 lg:py-24">
      <Container>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="max-w-lg font-display text-2xl font-medium tracking-tight text-espresso-950 sm:text-3xl">
            Ready to shop beauty, or start sourcing?
          </h3>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/sign-up">
              <Button size="lg" fullWidth className="sm:w-auto">
                Create your account
                <ArrowRight className="size-4" strokeWidth={2} />
              </Button>
            </Link>
            <Link href="/sell" className="text-sm font-medium text-espresso-800 hover:text-espresso-950">
              or become a vendor →
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
