import { notFound } from "next/navigation";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { quotationService } from "../../../../../modules/quotation/service";
import { QuoteStatusBadge } from "../../../../../components/quotation/QuoteStatusBadge";
import { formatPrice } from "../../../../../lib/format";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { BackLink } from "../../../../../components/ui/BackLink";

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
      <BackLink href="/admin/quotations" label="Back to quotations" />

      <PageHeader
        title={quote.reference}
        description={`${quote.customerName} · ${quote.customerEmail}`}
        actions={<QuoteStatusBadge status={quote.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <h2 className="font-display text-base font-medium text-espresso-950">Items</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-espresso-900/50">
                  <th className="py-2">Item</th>
                  <th className="py-2">Vendor</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Unit price</th>
                  <th className="py-2 text-right">Vendor payable</th>
                  <th className="py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-100">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 text-espresso-950">{item.description}</td>
                    <td className="py-2.5 text-espresso-900/65">{item.vendor?.companyName ?? "—"}</td>
                    <td className="py-2.5 text-right text-espresso-800">{item.quantity}</td>
                    <td className="py-2.5 text-right text-espresso-800">
                      {formatPrice(item.unitPrice, quote.currency)}
                    </td>
                    <td className="py-2.5 text-right text-espresso-900/50">
                      {formatPrice(item.vendorPayableBasis, quote.currency)}
                    </td>
                    <td className="py-2.5 text-right font-medium text-espresso-950">
                      {formatPrice(item.lineTotal, quote.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="font-display text-base font-medium text-espresso-950">Summary</h2>
            <div className="mt-3 flex justify-between text-sm text-espresso-900/65">
              <span>Subtotal</span>
              <span>{formatPrice(quote.subtotal, quote.currency)}</span>
            </div>
            <div className="mt-1 flex justify-between text-base font-semibold text-espresso-950">
              <span>Total</span>
              <span>{formatPrice(quote.total, quote.currency)}</span>
            </div>
            <div className="mt-4 flex flex-col gap-1 text-xs text-espresso-900/50">
              <span>Issued {formatDate(quote.issuedAt)}</span>
              <span>Valid until {formatDate(quote.expiresAt)}</span>
              {quote.acceptedAt ? <span>Accepted {formatDate(quote.acceptedAt)}</span> : null}
            </div>
          </Card>

          {quote.acceptedOrderId ? (
            <Card>
              <p className="text-sm text-espresso-900/50">This quotation converted to an order.</p>
              <p className="mt-1 text-sm font-medium text-espresso-800">Order id: {quote.acceptedOrderId}</p>
            </Card>
          ) : null}
        </div>
      </div>

    </div>
  );
}
