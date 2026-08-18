import { notFound, redirect } from "next/navigation";
import { Container } from "../../../../../../components/ui/Container";
import { CardReturnPoller } from "../../../../../../components/checkout/CardReturnPoller";
import { requireSession, getCurrentCustomerProfile } from "../../../../../../modules/identity/policy";
import { paymentsService } from "../../../../../../modules/payments/service";

type Params = { orderId: string };
type Search = { reference?: string; trxref?: string };

export const metadata = { title: "Confirming payment" };
export const dynamic = "force-dynamic";

/**
 * Card return-from-Paystack landing (M10B). This page NEVER treats the
 * browser's arrival here, or any query-string parameter, as proof of
 * anything — `reference` is used only as a lookup key
 * (paymentsService.getCardReturnStatusForCustomer), and the actual result
 * always comes from an independent server-side `provider.verify()` call
 * through the same funnel the webhook and polling paths use.
 */
export default async function PaymentCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { orderId } = await params;
  const sp = await searchParams;
  const reference = sp.reference ?? sp.trxref ?? null;

  const session = await requireSession(`/checkout/${orderId}/payment`);
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) {
    notFound();
  }

  const result = await paymentsService.getCardReturnStatusForCustomer({
    customerProfileId: customerProfile.id,
    orderId,
    reference,
  });

  if (!result.ok) {
    redirect(`/checkout/${orderId}/payment`);
  }

  if (result.value.status === "SUCCEEDED") {
    redirect(`/account/orders/${orderId}?confirmed=true`);
  }
  if (result.value.status === "FAILED" || result.value.status === "CANCELLED") {
    redirect(`/checkout/${orderId}/payment`);
  }

  return (
    <div className="bg-stone-50 py-10 sm:py-14">
      <Container className="max-w-xl">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center sm:p-8">
          <h1 className="font-display text-2xl font-medium text-stone-900">Confirming your payment</h1>
          <p className="mt-2 text-sm text-stone-500">This should only take a moment. Please don&apos;t close this page.</p>
          <CardReturnPoller orderId={orderId} paymentId={result.value.paymentId} />
        </div>
      </Container>
    </div>
  );
}
