import Link from "next/link";
import { ArrowRight, Receipt, Store } from "lucide-react";
import { Button } from "../../../components/ui/Button";
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
  const recentOrders = orders.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">
          Welcome back, {customerProfile?.displayName ?? session.user.name}
        </h1>
        <p className="mt-1 text-[15px] text-stone-500">
          Here&apos;s a quick look at your CrownSourceGlobal account.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/account/orders"
          className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-5 transition-shadow hover:shadow-lifted"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-100 text-brand-800">
              <Receipt className="size-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-medium text-stone-900">Orders</p>
              <p className="text-sm text-stone-500">
                {orders.length} order{orders.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 text-stone-400" />
        </Link>

        <Link
          href="/shop"
          className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-5 transition-shadow hover:shadow-lifted"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
              <Store className="size-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="font-medium text-stone-900">Continue shopping</p>
              <p className="text-sm text-stone-500">Browse the marketplace</p>
            </div>
          </div>
          <ArrowRight className="size-4 text-stone-400" />
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium text-stone-900">Recent orders</h2>
          {orders.length > 0 ? (
            <Link href="/account/orders" className="text-sm font-medium text-brand-700 hover:underline">
              View all
            </Link>
          ) : null}
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
            <p className="text-sm text-stone-500">You haven&apos;t placed an order yet.</p>
            <Link href="/shop">
              <Button variant="outline" className="mt-4">
                Start shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-stone-50"
              >
                <div>
                  <p className="text-sm font-medium text-stone-900">{order.orderNumber}</p>
                  <p className="text-xs text-stone-500">
                    {order.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={order.displayStatus} label={order.displayStatusLabel} />
                  <span className="text-sm font-semibold text-stone-900">
                    {formatPrice(order.total, order.currency)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
