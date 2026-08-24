import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { Alert } from "../../../../../components/ui/Alert";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { OrderStatusBadge } from "../../../../../components/account/OrderStatusBadge";
import { PackageTracking } from "../../../../../components/account/PackageTracking";
import { AskAboutButton } from "../../../../../components/messaging/AskAboutButton";
import { CaseStatusBadge } from "../../../../../components/resolutions/CaseStatusBadge";
import { formatPrice } from "../../../../../lib/format";
import { requireSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { ordersService } from "../../../../../modules/orders/service";
import { fulfilmentService } from "../../../../../modules/fulfilment/service";
import { resolutionsService } from "../../../../../modules/resolutions/service";

type Params = { id: string };

export const metadata = { title: "Order detail" };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ confirmed?: string }>;
}) {
  const { id } = await params;
  const { confirmed } = await searchParams;
  const session = await requireSession(`/account/orders/${id}`);
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) {
    notFound();
  }

  // Ownership is enforced inside getOrderDetail — it only ever queries by
  // (orderId, customerProfileId) together, so another customer's order id
  // simply returns null here rather than leaking data.
  const order = await ordersService.getOrderDetail(id, customerProfile.id);
  if (!order) {
    notFound();
  }

  const tracking =
    order.status === "CONFIRMED" || order.status === "FULFILLING" || order.status === "COMPLETED"
      ? await fulfilmentService.getCustomerTracking(id, customerProfile.id)
      : [];

  const allCases = await resolutionsService.listForCustomer(customerProfile.id);
  const orderCases = allCases.filter((c) => c.orderId === id);
  const canReportProblem = order.status === "CONFIRMED" || order.status === "FULFILLING" || order.status === "COMPLETED";

  const showConfirmationBanner = confirmed === "true" && order.status === "CONFIRMED";

  return (
    <div className="flex flex-col gap-6">
      {showConfirmationBanner ? (
        <Alert tone="success" title="Order confirmed">
          Thanks — we&apos;ve received your order and vendors are being notified.
        </Alert>
      ) : null}

      <PageHeader
        title={order.orderNumber}
        description={`Placed ${order.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
        actions={<OrderStatusBadge status={order.displayStatus} label={order.displayStatusLabel} />}
      />

      {order.status === "PENDING_PAYMENT" ? (
        <Alert tone="warning" title="Awaiting payment">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Complete payment to confirm this order with the vendor.</span>
            <Link href={`/checkout/${order.id}/payment`}>
              <Button size="sm">Complete payment</Button>
            </Link>
          </div>
        </Alert>
      ) : null}

      {tracking.length > 0 ? (
        <div className="flex flex-col gap-4">
          {tracking.length > 1 ? (
            <p className="text-sm text-espresso-900/65">
              Your order will arrive in {tracking.length} deliveries, one per vendor.
            </p>
          ) : null}
          {tracking.map((pkg, index) => {
            const derived = order.packages.find((p) => p.fulfilmentId === pkg.fulfilmentId);
            return (
              <PackageTracking
                key={pkg.fulfilmentId}
                tracking={pkg}
                orderId={order.id}
                multiPackage={tracking.length > 1}
                index={index}
                packageStatus={derived ? { status: derived.status, label: derived.statusLabel } : undefined}
              />
            );
          })}
          <div className="flex flex-wrap items-center gap-4">
            <AskAboutButton
              contextType="ORDER"
              contextRefId={order.id}
              currentPath={`/account/orders/${order.id}`}
              isSignedIn
              label="Get help with this delivery"
              placeholder="e.g. My package hasn't arrived, or the status looks wrong…"
            />
            {canReportProblem ? (
              <Link href={`/account/resolutions/new?orderId=${order.id}`} className="text-sm font-medium text-forest-800 hover:underline">
                Report a problem / request cancellation
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {orderCases.length > 0 ? (
        <div className="border-t border-ivory-300 pt-4">
          <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Issue reported</h2>
          <ul className="mt-2 flex flex-col divide-y divide-ivory-200">
            {orderCases.map((c) => (
              <li key={c.id}>
                <Link href={`/account/resolutions/${c.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-forest-800">
                  <span className="text-sm text-espresso-800">{c.caseNumber}</span>
                  <CaseStatusBadge status={c.status} label={c.statusLabel} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-8 border-t border-ivory-300 pt-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col divide-y divide-ivory-200">
          {order.vendorGroups.map((group) => (
            <div key={group.vendorName} className="py-5 first:pt-0">
              <p className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">
                {group.vendorName}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {group.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span className="text-espresso-800">
                      {item.description} × {item.quantity}
                    </span>
                    <span className="font-medium text-espresso-950">
                      {formatPrice(item.lineTotal, order.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col divide-y divide-ivory-200 lg:border-l lg:border-ivory-200 lg:pl-8">
          <div className="pb-5 first:pt-0">
            <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Summary</h2>
            <div className="mt-3 flex justify-between text-sm text-espresso-900/65">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal, order.currency)}</span>
            </div>
            <div className="mt-1 flex justify-between text-base font-semibold text-espresso-950">
              <span>Total</span>
              <span>{formatPrice(order.total, order.currency)}</span>
            </div>
          </div>

          {order.latestPayment ? (
            <div className="py-5">
              <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Payment</h2>
              <div className="mt-2 flex flex-col gap-1 text-sm text-espresso-900/65">
                <p>
                  {order.latestPayment.method === "MOBILE_MONEY"
                    ? `Mobile Money${order.latestPayment.network ? ` (${order.latestPayment.network})` : ""}`
                    : order.latestPayment.method === "CARD"
                      ? `Card${order.latestPayment.cardDisplay ? ` (${order.latestPayment.cardDisplay.brand} •••• ${order.latestPayment.cardDisplay.last4})` : ""}`
                      : "Development payment"}
                  {order.latestPayment.phoneMasked ? ` · ${order.latestPayment.phoneMasked}` : ""}
                </p>
                <p>{formatPrice(order.latestPayment.amount, order.latestPayment.currency)}</p>
                <p className="text-xs text-espresso-900/35">Ref: {order.latestPayment.reference}</p>
              </div>
            </div>
          ) : null}

          <div className="pt-5 last:pb-0">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">
              <MapPin className="size-3.5 text-espresso-900/40" strokeWidth={1.75} />
              Delivery to
            </h2>
            <div className="mt-2 text-sm leading-relaxed text-espresso-900/65">
              <p className="font-medium text-espresso-950">{order.deliveryInfo.recipientName}</p>
              <p>{order.deliveryInfo.phone}</p>
              <p>{order.deliveryInfo.addressLine1}</p>
              {order.deliveryInfo.addressLine2 ? <p>{order.deliveryInfo.addressLine2}</p> : null}
              <p>
                {order.deliveryInfo.city}, {order.deliveryInfo.region}
              </p>
              {order.deliveryInfo.notes ? (
                <p className="mt-2 text-espresso-900/50">Note: {order.deliveryInfo.notes}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Link href="/account/orders" className="text-sm font-medium text-forest-800 hover:underline">
        ← Back to orders
      </Link>
    </div>
  );
}
