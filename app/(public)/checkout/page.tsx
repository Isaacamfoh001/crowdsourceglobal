import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "../../../components/ui/Container";
import { CheckoutForm } from "../../../components/checkout/CheckoutForm";
import { formatPrice } from "../../../lib/format";
import { requireSession, getCurrentCustomerProfile } from "../../../modules/identity/policy";
import { cartService } from "../../../modules/cart/service";
import { addressesService } from "../../../modules/addresses/service";

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await requireSession("/checkout");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  const [cart, addresses] = await Promise.all([
    customerProfile
      ? cartService.getCartView(customerProfile.id)
      : Promise.resolve({ cartId: null, itemCount: 0, vendorGroups: [], subtotal: 0, currency: "GHS" }),
    customerProfile ? addressesService.listForCustomer(customerProfile.id) : Promise.resolve([]),
  ]);

  if (cart.vendorGroups.length === 0) {
    redirect("/cart");
  }

  return (
    <div className="bg-stone-50 py-10 sm:py-14">
      <Container>
        <h1 className="font-display text-3xl font-medium text-stone-900">Checkout</h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
            <h2 className="font-display text-lg font-medium text-stone-900">
              Delivery information
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              We&apos;ll pass this to the vendors fulfilling your order.
            </p>
            <div className="mt-6">
              <CheckoutForm addresses={addresses} />
            </div>
          </div>

          <div className="h-fit rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="font-display text-lg font-medium text-stone-900">Order summary</h2>

            <div className="mt-4 flex flex-col gap-4">
              {cart.vendorGroups.map((group) => (
                <div key={group.vendor.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                    {group.vendor.companyName}
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {group.lines.map((line) => (
                      <li key={line.id} className="flex justify-between text-sm text-stone-700">
                        <span className="truncate pr-2">
                          {line.title} × {line.quantity}
                        </span>
                        <span className="shrink-0 font-medium text-stone-900">
                          {formatPrice(line.lineTotal, line.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-stone-200 pt-4">
              <div className="flex justify-between text-sm text-stone-600">
                <span>Subtotal</span>
                <span>{formatPrice(cart.subtotal, cart.currency)}</span>
              </div>
              <div className="mt-1 flex justify-between text-base font-semibold text-stone-900">
                <span>Total</span>
                <span>{formatPrice(cart.subtotal, cart.currency)}</span>
              </div>
            </div>

            <Link href="/cart" className="mt-4 block text-center text-sm text-stone-500 hover:text-stone-700">
              Edit cart
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
