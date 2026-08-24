import { Container } from "../ui/Container";

const paths = [
  {
    title: "Shop normally",
    description:
      "Browse beauty listings from approved vendors and buy the way you would on any modern marketplace. Add products from different vendors to the same cart and check out once.",
  },
  {
    title: "Buy in bulk",
    description:
      "Select a larger quantity on eligible listings and get wholesale pricing instantly. Where pricing is already set, there's no back-and-forth before you can check out.",
  },
  {
    title: "Request custom sourcing",
    description:
      "Can't find it, need an unusual quantity, or have specific requirements? Tell us what you're looking for. We source it and send you a straightforward quotation.",
  },
];

/**
 * Typographic three-up (M14.4) — no icons, no bordered tiles. A hairline
 * top rule per column and generous type carry the distinction between
 * paths instead of chrome.
 */
export function PurchasingPaths() {
  return (
    <section id="marketplace" className="bg-ivory-50 py-16 sm:py-20 lg:py-28">
      <Container>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] text-champagne-700 uppercase">
            Three ways to buy
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-espresso-950 sm:text-4xl">
            Whatever you&apos;re buying, there&apos;s a path for it.
          </h2>
        </div>

        <div className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-3">
          {paths.map((path) => (
            <div key={path.title} className="border-t border-espresso-950/20 pt-5">
              <h3 className="font-display text-lg font-medium text-espresso-950">
                {path.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-espresso-900/65">
                {path.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
