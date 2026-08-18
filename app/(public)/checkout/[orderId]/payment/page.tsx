import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { FlaskConical, ShieldCheck } from "lucide-react";
import { Container } from "../../../../../components/ui/Container";
import { Badge } from "../../../../../components/ui/Badge";
import { MockPaymentForm } from "../../../../../components/checkout/MockPaymentForm";
import { PaymentMethodTabs } from "../../../../../components/checkout/PaymentMethodTabs";
import { formatPrice } from "../../../../../lib/format";
import { env } from "../../../../../lib/env";
import { requireSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { ordersService } from "../../../../../modules/orders/service";

type Params = { orderId: string };

export const metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<Params> }) {
  const { orderId } = await params;
  const session = await requireSession(`/checkout/${orderId}/payment`);
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) {
    notFound();
  }

  const order = await ordersService.getOrderDetail(orderId, customerProfile.id);
  if (!order) {
    notFound();
  }

  if (order.status === "CONFIRMED") {
    redirect(`/account/orders/${orderId}?confirmed=true`);
  }
  if (order.status !== "PENDING_PAYMENT") {
    redirect(`/account/orders/${orderId}`);
  }

  // Fresh per page load — a double-click within this render reuses the
  // same key (idempotent no-op on the second submit); reloading the page
  // to retry after a failure is a new, intentional attempt.
  const idempotencyKey = randomUUID();

  // Both real providers (Paystack, primary; Moolre, experimental/deferred)
  // share the exact same customer-facing Mobile Money form and flow —
  // provider identity is an implementation detail never surfaced here.
  const isRealMobileMoney = env.PAYMENT_PROVIDER === "paystack" || env.PAYMENT_PROVIDER === "moolre";
  // Card is always Paystack-hosted Checkout (M10B), independent of
  // env.PAYMENT_PROVIDER — gated only on Paystack credentials actually
  // being configured, server-side only, never exposed to the client.
  const isCardAvailable = Boolean(env.PAYSTACK_SECRET_KEY);
  const isRealPayment = isRealMobileMoney || isCardAvailable;

  return (
    <div className="bg-stone-50 py-10 sm:py-14">
      <Container className="max-w-xl">
        <div className="mb-6 flex justify-center">
          {isRealPayment ? (
            <Badge tone="gold" className="normal-case">
              <ShieldCheck className="size-3.5" strokeWidth={2} />
              Secure payment
            </Badge>
          ) : (
            <Badge tone="gold" className="normal-case">
              <FlaskConical className="size-3.5" strokeWidth={2} />
              Development mode — simulated payment
            </Badge>
          )}
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
          <h1 className="text-center font-display text-2xl font-medium text-stone-900">
            Complete payment
          </h1>
          <p className="mt-1.5 text-center text-sm text-stone-500">Order {order.orderNumber}</p>

          <div className="mt-6 flex justify-between border-y border-stone-100 py-4 text-lg">
            <span className="font-medium text-stone-700">Total</span>
            <span className="font-semibold text-stone-900">
              {formatPrice(order.total, order.currency)}
            </span>
          </div>

          {isRealPayment ? (
            <div className="mt-6">
              <PaymentMethodTabs orderId={order.id} showMobileMoney={isRealMobileMoney} showCard={isCardAvailable} />
            </div>
          ) : (
            <>
              <p className="mt-4 text-center text-sm leading-relaxed text-stone-500">
                This is a simulated payment for development — no real money moves and no card
                details are collected. Choose an outcome below to continue.
              </p>
              <div className="mt-6">
                <MockPaymentForm orderId={order.id} idempotencyKey={idempotencyKey} />
              </div>
            </>
          )}
        </div>
      </Container>
    </div>
  );
}
