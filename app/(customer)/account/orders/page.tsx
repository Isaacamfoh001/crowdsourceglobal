import Link from "next/link";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { OrderStatusBadge } from "../../../../components/account/OrderStatusBadge";
import { formatPrice } from "../../../../lib/format";
import { requireSession } from "../../../../modules/identity/policy";
import { identityService } from "../../../../modules/identity/service";
import { ordersService } from "../../../../modules/orders/service";

export const metadata = { title: "Your orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await requireSession("/account/orders");
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  const orders = customerProfile ? await ordersService.listOrders(customerProfile.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-espresso-950">Your orders</h1>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="You haven't placed an order yet."
          actionHref="/shop"
          actionLabel="Start shopping"
        />
      ) : (
        <div className="divide-y divide-ivory-200 border-t border-ivory-300">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="flex flex-col gap-2 py-4 transition-colors hover:bg-ivory-100/60 sm:flex-row sm:items-center sm:justify-between sm:px-2"
            >
              <div>
                <p className="text-[15px] font-medium text-espresso-950">{order.orderNumber}</p>
                <p className="mt-0.5 text-xs text-espresso-900/50">
                  {order.createdAt.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  · {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <OrderStatusBadge status={order.displayStatus} label={order.displayStatusLabel} />
                <span className="text-sm font-semibold text-espresso-950">
                  {formatPrice(order.total, order.currency)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
