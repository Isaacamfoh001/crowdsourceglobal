import { Layers, PackageSearch, ShoppingBag } from "lucide-react";
import { Container } from "../ui/Container";

const paths = [
  {
    icon: ShoppingBag,
    title: "Shop normally",
    description:
      "Browse listings from approved vendors and buy the way you would on any modern marketplace. Add products from different vendors to the same cart and check out once.",
  },
  {
    icon: Layers,
    title: "Buy in bulk",
    description:
      "Select a larger quantity on eligible listings and get wholesale pricing instantly. Where pricing is already set, there's no back-and-forth before you can check out.",
  },
  {
    icon: PackageSearch,
    title: "Request custom sourcing",
    description:
      "Can't find it, need an unusual quantity, or have specific requirements? Tell us what you're looking for. We source it and send you a straightforward quotation.",
  },
];

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
          <p className="mt-4 text-lg leading-relaxed text-espresso-900/70">
            Ordinary purchases stay simple. Bulk and custom needs are handled without extra
            complexity getting in your way.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((path) => (
            <div
              key={path.title}
              className="flex flex-col border border-ivory-400 bg-ivory-100/60 p-7 transition-colors hover:border-champagne-400/60"
            >
              <path.icon className="size-8 text-champagne-600" strokeWidth={1.25} />
              <h3 className="mt-5 font-display text-lg font-medium text-espresso-950">
                {path.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-espresso-900/70">
                {path.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
