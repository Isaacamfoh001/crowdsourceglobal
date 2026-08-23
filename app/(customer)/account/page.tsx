import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { OrderStatusBadge } from "../../../components/account/OrderStatusBadge";
import { formatPrice } from "../../../lib/format";
import { requireSession } from "../../../modules/identity/policy";
import { identityService } from "../../../modules/identity/service";
import { ordersService } from "../../../modules/orders/service";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountOverviewPage() {
  const session = await requireSession("/account");
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  const orders = customerProfile ? await ordersService.listOrders(customerProfile.id) : [];
  const recentOrders = orders.slice(0, 5);
  const needsPayment = orders.filter((o) => o.status === "PENDING_PAYMENT");

  return (
    <div className="flex flex-col gap-8">
      {/* Warm welcome band (M14.2) — replaces a plain page title with a
          branded greeting and the single highest-value action, rather than
          a grid of generic nav cards duplicating the sidebar. */}
      <div className="rounded-2xl border border-champagne-200 bg-champagne-200/20">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-forest-800 uppercase">Your account</p>
            <h1 className="mt-1 font-display text-2xl font-medium text-espresso-950 sm:text-[28px]">
              Welcome back, {customerProfile?.displayName ?? session.user.name}
            </h1>
            <p className="mt-1.5 text-sm text-espresso-900/65">
              {orders.length > 0
                ? `${orders.length} order${orders.length === 1 ? "" : "s"} on your account.`
                : "You haven't placed an order yet."}
            </p>
          </div>
          <Link href="/shop">
            <Button size="lg" variant={orders.length === 0 ? "primary" : "outline"}>
              Continue shopping
            </Button>
          </Link>
        </div>
      </div>

      {needsPayment.length > 0 ? (
        <div>
          <h2 className="font-display text-lg font-medium text-espresso-950">Needs your attention</h2>
          <div className="mt-3 flex flex-col gap-2">
            {needsPayment.map((order) => (
              <Link
                key={order.id}
                href={`/checkout/${order.id}/payment`}
                className="flex items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4 transition-colors hover:border-warning-300"
              >
                <AlertTriangle className="size-5 shrink-0 text-warning-700" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-espresso-950">Order {order.orderNumber}</p>
                  <p className="mt-0.5 text-sm text-espresso-900/65">Awaiting payment — complete it to confirm your order.</p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-espresso-900/35" strokeWidth={1.75} />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-espresso-950">Recent orders</h2>
          {orders.length > 0 ? (
            <Link href="/account/orders" className="text-sm font-medium text-forest-800 hover:underline">
              View all
            </Link>
          ) : null}
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No orders yet"
              description="Your recent orders will show up here."
              actionHref="/shop"
              actionLabel="Start shopping"
            />
          </div>
        ) : (
          <Card as="div" padded={false} className="mt-4 divide-y divide-ivory-100">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-ivory-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-espresso-950">{order.orderNumber}</p>
                  <p className="text-xs text-espresso-900/50">
                    {order.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <OrderStatusBadge status={order.displayStatus} label={order.displayStatusLabel} />
                  <span className="hidden text-sm font-semibold text-espresso-950 sm:inline">
                    {formatPrice(order.total, order.currency)}
                  </span>
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
