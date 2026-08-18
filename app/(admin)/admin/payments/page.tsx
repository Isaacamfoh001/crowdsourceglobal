import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { paymentsService } from "../../../../modules/payments/service";
import { formatPrice } from "../../../../lib/format";

export const metadata = { title: "Payments — Admin" };
export const dynamic = "force-dynamic";

const ADMIN_FINANCE_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN"] as const;

const STATUS_FILTERS = [
  { value: undefined, label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "SUCCEEDED", label: "Succeeded" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; attention?: string }>;
}) {
  await requireAdminSession("/admin/payments", [...ADMIN_FINANCE_ROLES]);
  const { status, attention } = await searchParams;
  const activeStatus = STATUS_FILTERS.find((f) => f.value === status)?.value;
  const requiresAttention = attention === "1";

  const payments = await paymentsService.listForAdmin({
    status: activeStatus as "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | undefined,
    requiresAttention: requiresAttention || undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-stone-900">Payments</h1>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/payments?status=${filter.value}` : "/admin/payments"}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeStatus === filter.value && !requiresAttention
                ? "bg-brand-700 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
        <Link
          href="/admin/payments?attention=1"
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
            requiresAttention ? "bg-red-600 text-white" : "bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50"
          }`}
        >
          Requires attention
        </Link>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">No payments found.</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {payments.map((p) => (
            <Link
              key={p.id}
              href={`/admin/payments/${p.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{p.reference}</p>
                <p className="text-xs text-stone-500">
                  Order {p.order.orderNumber} · {p.order.customerProfile.displayName} · {p.provider}
                  {p.network ? ` (${p.network})` : ""}
                  {p.exceptionReason ? " · needs attention" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-stone-900">{formatPrice(p.amount.toNumber(), p.currency)}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    p.exceptionReason
                      ? "bg-red-100 text-red-700"
                      : p.status === "SUCCEEDED"
                        ? "bg-emerald-100 text-emerald-700"
                        : p.status === "FAILED" || p.status === "CANCELLED"
                          ? "bg-stone-200 text-stone-600"
                          : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {p.exceptionReason ? "ATTENTION" : p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
