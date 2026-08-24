import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Container } from "../../../components/ui/Container";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { EmptyState } from "../../../components/ui/EmptyState";
import { CartLineItem } from "../../../components/cart/CartLineItem";
import { formatPrice } from "../../../lib/format";
import { requireSession, getCurrentCustomerProfile } from "../../../modules/identity/policy";
import { cartService } from "../../../modules/cart/service";

export const metadata = { title: "Your cart" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await requireSession("/cart");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  const cart = customerProfile
    ? await cartService.getCartView(customerProfile.id)
    : { cartId: null, itemCount: 0, vendorGroups: [], subtotal: 0, currency: "GHS" };

  return (
    <div className="bg-ivory-50">
      <div className="bg-espresso-950 py-7 sm:py-9">
        <Container>
          <PageHeader
            title="Your cart"
            description={
              cart.vendorGroups.length > 0
                ? `${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"} from ${cart.vendorGroups.length} vendor${cart.vendorGroups.length === 1 ? "" : "s"}, one checkout.`
                : "Browse the marketplace to add items."
            }
            className="[&_h1]:text-white [&_p]:text-ivory-200/55"
          />
        </Container>
      </div>

      <Container className={`py-10 sm:py-14 ${cart.vendorGroups.length > 0 ? "pb-28 lg:pb-14" : ""}`}>
        {cart.vendorGroups.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="Your cart is empty"
              description="Browse the marketplace to find what you need."
              actionHref="/shop"
              actionLabel="Continue shopping"
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-6">
              {cart.vendorGroups.map((group) => (
                <Card key={group.vendor.id}>
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/vendors/${group.vendor.storefrontSlug}`}
                      className="flex min-w-0 items-center gap-2 font-display text-[15px] font-medium text-espresso-950 hover:text-forest-900"
                    >
                      <ShoppingBag className="size-4 shrink-0 text-espresso-900/35" strokeWidth={1.75} />
                      <span className="truncate">{group.vendor.companyName}</span>
                    </Link>
                    <span className="shrink-0 text-sm text-espresso-900/50">
                      {formatPrice(group.subtotal, cart.currency)}
                    </span>
                  </div>

                  <div className="mt-2">
                    {group.lines.map((line) => (
                      <CartLineItem key={line.id} line={line} />
                    ))}
                  </div>
                </Card>
              ))}

              <Link href="/shop" className="text-sm font-medium text-forest-800 hover:underline">
                ← Continue shopping
              </Link>
            </div>

            <Card as="div" elevated className="h-fit">
              <h2 className="font-display text-lg font-medium text-espresso-950">Order summary</h2>
              <div className="mt-4 flex justify-between text-sm text-espresso-900/65">
                <span>
                  Subtotal ({cart.itemCount} item{cart.itemCount === 1 ? "" : "s"})
                </span>
                <span className="font-medium text-espresso-950">
                  {formatPrice(cart.subtotal, cart.currency)}
                </span>
              </div>
              <p className="mt-1 text-xs text-espresso-900/35">
                Delivery is arranged after checkout.
              </p>
              <Link href="/checkout" className="hidden lg:block">
                <Button size="lg" fullWidth className="mt-5">
                  Proceed to checkout
                </Button>
              </Link>
            </Card>
          </div>
        )}
      </Container>

      {/* Persistent mobile checkout action — on a long multi-vendor cart the
          desktop sidebar summary can be several screens below the fold, so
          the primary action stays reachable without scrolling. */}
      {cart.vendorGroups.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ivory-300 bg-ivory-50/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-espresso-900/50">
                {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
              </p>
              <p className="text-base font-semibold text-espresso-950">
                {formatPrice(cart.subtotal, cart.currency)}
              </p>
            </div>
            <Link href="/checkout" className="shrink-0">
              <Button size="lg">Checkout</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
