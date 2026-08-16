import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { FormMessage } from "../../../../../components/ui/FormMessage";
import { OrderStatusBadge } from "../../../../../components/account/OrderStatusBadge";
import { PackageTracking } from "../../../../../components/account/PackageTracking";
import { AskAboutButton } from "../../../../../components/messaging/AskAboutButton";
import { formatPrice } from "../../../../../lib/format";
import { requireSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { ordersService } from "../../../../../modules/orders/service";
import { fulfilmentService } from "../../../../../modules/fulfilment/service";

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

  const showConfirmationBanner = confirmed === "true" && order.status === "CONFIRMED";

  return (
    <div className="flex flex-col gap-6">
      {showConfirmationBanner ? (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand-700" strokeWidth={1.75} />
          <div>
            <p className="font-display text-lg font-medium text-brand-900">Order confirmed</p>
            <p className="mt-1 text-sm text-brand-800">
              Thanks — we&apos;ve received your order and vendors are being notified.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-stone-500">
            Placed{" "}
            {order.createdAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === "PENDING_PAYMENT" ? (
        <FormMessage tone="error">
          <div className="flex items-center justify-between gap-4">
            <span>This order is awaiting payment.</span>
            <Link href={`/checkout/${order.id}/payment`}>
              <Button size="sm">Complete payment</Button>
            </Link>
          </div>
        </FormMessage>
      ) : null}

      {tracking.length > 0 ? (
        <div className="flex flex-col gap-4">
          {tracking.length > 1 ? (
            <p className="text-sm text-stone-600">
              Your order will arrive in {tracking.length} deliveries, one per vendor.
            </p>
          ) : null}
          {tracking.map((pkg, index) => (
            <PackageTracking key={pkg.fulfilmentId} tracking={pkg} orderId={order.id} multiPackage={tracking.length > 1} index={index} />
          ))}
          <div>
            <AskAboutButton
              contextType="ORDER"
              contextRefId={order.id}
              currentPath={`/account/orders/${order.id}`}
              isSignedIn
              label="Get help with this delivery"
              placeholder="e.g. My package hasn't arrived, or the status looks wrong…"
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {order.vendorGroups.map((group) => (
            <div key={group.vendorName} className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="font-display text-[15px] font-medium text-stone-900">
                {group.vendorName}
              </p>
              <ul className="mt-3 divide-y divide-stone-100">
                {group.items.map((item) => (
                  <li key={item.id} className="flex justify-between py-2.5 text-sm">
                    <span className="text-stone-700">
                      {item.description} × {item.quantity}
                    </span>
                    <span className="font-medium text-stone-900">
                      {formatPrice(item.lineTotal, order.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-base font-medium text-stone-900">Summary</h2>
            <div className="mt-3 flex justify-between text-sm text-stone-600">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal, order.currency)}</span>
            </div>
            <div className="mt-1 flex justify-between text-base font-semibold text-stone-900">
              <span>Total</span>
              <span>{formatPrice(order.total, order.currency)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="flex items-center gap-1.5 font-display text-base font-medium text-stone-900">
              <MapPin className="size-4 text-stone-400" strokeWidth={1.75} />
              Delivery to
            </h2>
            <div className="mt-2 text-sm leading-relaxed text-stone-600">
              <p className="font-medium text-stone-900">{order.deliveryInfo.recipientName}</p>
              <p>{order.deliveryInfo.phone}</p>
              <p>{order.deliveryInfo.addressLine1}</p>
              {order.deliveryInfo.addressLine2 ? <p>{order.deliveryInfo.addressLine2}</p> : null}
              <p>
                {order.deliveryInfo.city}, {order.deliveryInfo.region}
              </p>
              {order.deliveryInfo.notes ? (
                <p className="mt-2 text-stone-500">Note: {order.deliveryInfo.notes}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <Link href="/account/orders" className="text-sm font-medium text-brand-700 hover:underline">
        ← Back to orders
      </Link>
    </div>
  );
}
