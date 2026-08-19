import Link from "next/link";
import { Button } from "../../../../components/ui/Button";
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
      <h1 className="font-display text-2xl font-medium text-stone-900">Your orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">You haven&apos;t placed an order yet.</p>
          <Link href="/shop">
            <Button variant="outline" className="mt-4">
              Start shopping
            </Button>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{order.orderNumber}</p>
                <p className="text-xs text-stone-500">
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
                <span className="text-sm font-semibold text-stone-900">
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
