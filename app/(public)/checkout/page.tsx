import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "../../../components/ui/Container";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
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
    <div className="bg-ivory-50">
      <div className="border-b border-ivory-300 py-7 sm:py-9">
        <Container>
          <PageHeader title="Checkout" description="Review your order and confirm delivery details." />
          <div className="mt-5 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
            <span className="flex items-center gap-1.5 text-espresso-950">
              <span className="flex size-5 items-center justify-center rounded-full bg-espresso-800 text-[11px] text-ivory-50">1</span>
              Delivery
            </span>
            <span className="h-px w-6 bg-ivory-300" aria-hidden="true" />
            <span className="flex items-center gap-1.5 text-espresso-900/35">
              <span className="flex size-5 items-center justify-center rounded-full border border-ivory-400 text-[11px]">2</span>
              Payment
            </span>
          </div>
        </Container>
      </div>

      <Container className="py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <Card className="sm:p-8">
            <h2 className="font-display text-lg font-medium text-espresso-950">
              Delivery information
            </h2>
            <p className="mt-1 text-sm text-espresso-900/50">
              We&apos;ll pass this to the vendors fulfilling your order.
            </p>
            <div className="mt-6">
              <CheckoutForm addresses={addresses} />
            </div>
          </Card>

          <Card as="div" elevated className="h-fit lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-medium text-espresso-950">Order summary</h2>

            <div className="mt-4 flex flex-col gap-4">
              {cart.vendorGroups.map((group) => (
                <div key={group.vendor.id}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-espresso-900/35">
                    {group.vendor.companyName}
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {group.lines.map((line) => (
                      <li key={line.id} className="flex justify-between text-sm text-espresso-800">
                        <span className="truncate pr-2">
                          {line.title} × {line.quantity}
                        </span>
                        <span className="shrink-0 font-medium text-espresso-950">
                          {formatPrice(line.lineTotal, line.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-ivory-300 pt-4">
              <div className="flex justify-between text-sm text-espresso-900/65">
                <span>Subtotal</span>
                <span>{formatPrice(cart.subtotal, cart.currency)}</span>
              </div>
              <div className="mt-1 flex justify-between text-base font-semibold text-espresso-950">
                <span>Total</span>
                <span>{formatPrice(cart.subtotal, cart.currency)}</span>
              </div>
            </div>

            <Link href="/cart" className="mt-4 block text-center text-sm text-espresso-900/50 hover:text-espresso-800">
              Edit cart
            </Link>
          </Card>
        </div>
      </Container>
    </div>
  );
}
