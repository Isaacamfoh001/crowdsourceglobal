import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { QuoteStatusBadge } from "../../../../../components/quotation/QuoteStatusBadge";
import { ReissueQuoteButton } from "../../../../../components/quotation/ReissueQuoteButton";
import { formatPrice } from "../../../../../lib/format";
import { requireSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { quotationService } from "../../../../../modules/quotation/service";

type Params = { id: string };

export const metadata = { title: "Quotation detail" };
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ issued?: string }>;
}) {
  const { id } = await params;
  const { issued } = await searchParams;
  const session = await requireSession(`/account/quotes/${id}`);
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) {
    notFound();
  }

  // Ownership is enforced inside getDetailForCustomer — it only ever
  // queries by (id, customerProfileId) together, so another customer's
  // quote id simply returns null here rather than leaking data.
  const quote = await quotationService.getDetailForCustomer(id, customerProfile.id);
  if (!quote) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      {issued === "true" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand-700" strokeWidth={1.75} />
          <div>
            <p className="font-display text-lg font-medium text-brand-900">Your quotation is ready</p>
            <p className="mt-1 text-sm text-brand-800">
              {quote.reference} · {formatPrice(quote.total, quote.currency)} · valid until{" "}
              {formatDate(quote.expiresAt)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">{quote.reference}</h1>
          <p className="mt-1 text-sm text-stone-500">
            Issued {formatDate(quote.issuedAt)} · valid until {formatDate(quote.expiresAt)}
          </p>
        </div>
        <QuoteStatusBadge status={quote.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-display text-base font-medium text-stone-900">Items</h2>
          <ul className="mt-3 divide-y divide-stone-100">
            {quote.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {item.description} × {item.quantity}
                  </p>
                  {item.vendor ? (
                    <p className="text-xs text-stone-500">{item.vendor.companyName}</p>
                  ) : null}
                </div>
                <span className="text-sm font-semibold text-stone-900">
                  {formatPrice(item.lineTotal, quote.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-base font-medium text-stone-900">Summary</h2>
            <div className="mt-3 flex justify-between text-sm text-stone-600">
              <span>Subtotal</span>
              <span>{formatPrice(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="mt-1 flex justify-between text-base font-semibold text-stone-900">
              <span>Total</span>
              <span>{formatPrice(quote.total, quote.currency)}</span>
            </div>
            <p className="mt-3 text-xs text-stone-400">
              Pricing quoted here is locked and will not change, even if catalogue pricing changes
              before this quote&apos;s validity period ends.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            {quote.status === "ISSUED" ? (
              <Link href={`/checkout/quote/${quote.id}`}>
                <Button size="lg" fullWidth>
                  Proceed to Checkout
                </Button>
              </Link>
            ) : null}
            {quote.status === "EXPIRED" ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-stone-500">This quotation has expired and can no longer be used.</p>
                <ReissueQuoteButton quotationId={quote.id} />
              </div>
            ) : null}
            {quote.status === "ACCEPTED" && quote.acceptedOrderId ? (
              <Link href={`/account/orders/${quote.acceptedOrderId}`}>
                <Button size="lg" fullWidth>
                  View Order
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <Link href="/account/quotes" className="text-sm font-medium text-brand-700 hover:underline">
        ← Back to quotes
      </Link>
    </div>
  );
}
