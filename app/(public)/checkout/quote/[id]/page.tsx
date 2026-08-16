import { notFound, redirect } from "next/navigation";
import { Container } from "../../../../../components/ui/Container";
import { QuoteCheckoutForm } from "../../../../../components/checkout/QuoteCheckoutForm";
import { formatPrice } from "../../../../../lib/format";
import { requireSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { quotationService } from "../../../../../modules/quotation/service";

type Params = { id: string };

export const metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function QuoteCheckoutPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const session = await requireSession(`/checkout/quote/${id}`);
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) {
    notFound();
  }

  const quote = await quotationService.getDetailForCustomer(id, customerProfile.id);
  if (!quote) {
    notFound();
  }

  if (quote.status === "ACCEPTED" && quote.acceptedOrderId) {
    redirect(`/account/orders/${quote.acceptedOrderId}`);
  }
  if (quote.status !== "ISSUED") {
    redirect(`/account/quotes/${id}`);
  }

  return (
    <div className="bg-stone-50 py-10 sm:py-14">
      <Container>
        <h1 className="font-display text-3xl font-medium text-stone-900">Checkout</h1>
        <p className="mt-1 text-sm text-stone-500">From quotation {quote.reference}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
            <h2 className="font-display text-lg font-medium text-stone-900">Delivery information</h2>
            <p className="mt-1 text-sm text-stone-500">
              We&apos;ll pass this to the vendors fulfilling your order.
            </p>
            <div className="mt-6">
              <QuoteCheckoutForm quotationId={quote.id} />
            </div>
          </div>

          <div className="h-fit rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="font-display text-lg font-medium text-stone-900">Quote summary</h2>

            <ul className="mt-4 flex flex-col gap-1.5">
              {quote.items.map((item) => (
                <li key={item.id} className="flex justify-between text-sm text-stone-700">
                  <span className="truncate pr-2">
                    {item.description} × {item.quantity}
                  </span>
                  <span className="shrink-0 font-medium text-stone-900">
                    {formatPrice(item.lineTotal, quote.currency)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-stone-200 pt-4">
              <div className="flex justify-between text-sm text-stone-600">
                <span>Subtotal</span>
                <span>{formatPrice(quote.subtotal, quote.currency)}</span>
              </div>
              <div className="mt-1 flex justify-between text-base font-semibold text-stone-900">
                <span>Total</span>
                <span>{formatPrice(quote.total, quote.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
