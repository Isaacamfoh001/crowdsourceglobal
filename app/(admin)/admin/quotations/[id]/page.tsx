import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { quotationService } from "../../../../../modules/quotation/service";
import { QuoteStatusBadge } from "../../../../../components/quotation/QuoteStatusBadge";
import { formatPrice } from "../../../../../lib/format";

type Params = { id: string };

export const metadata = { title: "Quotation — Admin" };
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminQuotationDetailPage({ params }: { params: Promise<Params> }) {
  await requireAdminSession("/admin/quotations");
  const { id } = await params;

  const quote = await quotationService.getDetailForAdmin(id);
  if (!quote) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">{quote.reference}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {quote.customerName} · {quote.customerEmail}
          </p>
        </div>
        <QuoteStatusBadge status={quote.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-display text-base font-medium text-stone-900">Items</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <th className="py-2">Item</th>
                  <th className="py-2">Vendor</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit price</th>
                  <th className="py-2 text-right">Vendor payable</th>
                  <th className="py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 text-stone-900">{item.description}</td>
                    <td className="py-2.5 text-stone-600">{item.vendor?.companyName ?? "—"}</td>
                    <td className="py-2.5 text-right text-stone-700">{item.quantity}</td>
                    <td className="py-2.5 text-right text-stone-700">
                      {formatPrice(item.unitPrice, quote.currency)}
                    </td>
                    <td className="py-2.5 text-right text-stone-500">
                      {formatPrice(item.vendorPayableBasis, quote.currency)}
                    </td>
                    <td className="py-2.5 text-right font-medium text-stone-900">
                      {formatPrice(item.lineTotal, quote.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <div className="mt-4 flex flex-col gap-1 text-xs text-stone-500">
              <span>Issued {formatDate(quote.issuedAt)}</span>
              <span>Valid until {formatDate(quote.expiresAt)}</span>
              {quote.acceptedAt ? <span>Accepted {formatDate(quote.acceptedAt)}</span> : null}
            </div>
          </div>

          {quote.acceptedOrderId ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-sm text-stone-500">This quotation converted to an order.</p>
              <p className="mt-1 text-sm font-medium text-brand-700">Order id: {quote.acceptedOrderId}</p>
            </div>
          ) : null}
        </div>
      </div>

      <Link href="/admin/quotations" className="text-sm font-medium text-brand-700 hover:underline">
        ← Back to quotations
      </Link>
    </div>
  );
}
