import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { paymentsService } from "../../../../../modules/payments/service";
import { formatPrice } from "../../../../../lib/format";
import { ReconcilePaymentButton } from "../../../../../components/admin/ReconcilePaymentButton";

export const metadata = { title: "Payment — Admin" };
export const dynamic = "force-dynamic";

const ADMIN_FINANCE_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN"] as const;

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-espresso-900/50">{label}</span>
      <span className="text-right font-medium text-espresso-950">{value}</span>
    </div>
  );
}

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession("/admin/payments", [...ADMIN_FINANCE_ROLES]);
  const { id } = await params;

  const payment = await paymentsService.getForAdmin(id);
  if (!payment) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/admin/payments" className="text-sm text-espresso-900/50 hover:text-espresso-800">
          ← Payments
        </Link>
        <h1 className="mt-2 font-display text-2xl font-medium text-espresso-950">{payment.reference}</h1>
      </div>

      {payment.exceptionReason ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800">
          <p className="font-medium">Requires attention</p>
          <p className="mt-1">{payment.exceptionReason}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-ivory-300 bg-white p-6">
        <Field label="Order" value={payment.order.orderNumber} />
        <Field label="Customer" value={payment.order.customerProfile.displayName} />
        <Field label="Amount" value={formatPrice(payment.amount.toNumber(), payment.currency)} />
        <Field label="Provider" value={payment.provider} />
        <Field label="Method" value={payment.method} />
        <Field label="Network" value={payment.network ?? "—"} />
        <Field label="Phone" value={payment.phoneMasked ?? "—"} />
        <Field label="Card" value={payment.cardBrand && payment.cardLast4 ? `${payment.cardBrand} •••• ${payment.cardLast4}` : "—"} />
        <Field label="Status" value={payment.status} />
        <Field label="Provider reference" value={payment.providerReference ?? "—"} />
        <Field label="Provider status code" value={payment.providerStatus ?? "—"} />
        <Field label="Last verified" value={payment.lastVerifiedAt ? payment.lastVerifiedAt.toLocaleString() : "Never"} />
        <Field label="Attempt #" value={payment.attemptNumber} />
        <Field label="Initiated" value={payment.initiatedAt.toLocaleString()} />
        <Field label="Confirmed" value={payment.confirmedAt ? payment.confirmedAt.toLocaleString() : "—"} />
        {payment.failureReasonSafe ? <Field label="Failure reason" value={payment.failureReasonSafe} /> : null}
      </div>

      {payment.provider !== "MOCK" && (payment.status === "PENDING" || payment.status === "INITIATED" || payment.exceptionReason) ? (
        <ReconcilePaymentButton paymentId={payment.id} />
      ) : null}
    </div>
  );
}
