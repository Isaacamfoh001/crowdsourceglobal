import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Container } from "../../../components/ui/Container";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/catalogue/EmptyState";
import { CartLineItem } from "../../../components/cart/CartLineItem";
import { formatPrice } from "../../../lib/format";
import { requireSession } from "../../../modules/identity/policy";
import { identityService } from "../../../modules/identity/service";
import { cartService } from "../../../modules/cart/service";

export const metadata = { title: "Your cart" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await requireSession("/cart");
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  const cart = customerProfile
    ? await cartService.getCartView(customerProfile.id)
    : { cartId: null, itemCount: 0, vendorGroups: [], subtotal: 0, currency: "GHS" };

  return (
    <div className="bg-stone-50 py-10 sm:py-14">
      <Container>
        <h1 className="font-display text-3xl font-medium text-stone-900">Your cart</h1>

        {cart.vendorGroups.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="Your cart is empty"
              description="Browse the marketplace to find what you need."
            />
            <div className="mt-6 flex justify-center">
              <Link href="/shop">
                <Button>Continue shopping</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-6">
              {cart.vendorGroups.map((group) => (
                <div
                  key={group.vendor.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/vendors/${group.vendor.storefrontSlug}`}
                      className="flex items-center gap-2 font-display text-[15px] font-medium text-stone-900 hover:text-brand-800"
                    >
                      <ShoppingBag className="size-4 text-stone-400" strokeWidth={1.75} />
                      {group.vendor.companyName}
                    </Link>
                    <span className="text-sm text-stone-500">
                      {formatPrice(group.subtotal, cart.currency)}
                    </span>
                  </div>

                  <div className="mt-2">
                    {group.lines.map((line) => (
                      <CartLineItem key={line.id} line={line} />
                    ))}
                  </div>
                </div>
              ))}

              <Link href="/shop" className="text-sm font-medium text-brand-700 hover:underline">
                ← Continue shopping
              </Link>
            </div>

            <div className="h-fit rounded-2xl border border-stone-200 bg-white p-6">
              <h2 className="font-display text-lg font-medium text-stone-900">Order summary</h2>
              <div className="mt-4 flex justify-between text-sm text-stone-600">
                <span>
                  Subtotal ({cart.itemCount} item{cart.itemCount === 1 ? "" : "s"})
                </span>
                <span className="font-medium text-stone-900">
                  {formatPrice(cart.subtotal, cart.currency)}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-400">
                Delivery is arranged after checkout.
              </p>
              <Link href="/checkout">
                <Button size="lg" fullWidth className="mt-5">
                  Proceed to checkout
                </Button>
              </Link>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
