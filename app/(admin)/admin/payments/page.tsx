import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { paymentsService } from "../../../../modules/payments/service";
import { formatPrice } from "../../../../lib/format";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Card } from "../../../../components/ui/Card";
import { StatusBadge } from "../../../../components/ui/StatusBadge";

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

const PROVIDER_FILTERS = [
  { value: undefined, label: "All providers" },
  { value: "PAYSTACK", label: "Paystack" },
  { value: "MOOLRE", label: "Moolre" },
  { value: "MOCK", label: "Mock" },
] as const;

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; provider?: string; attention?: string; page?: string }>;
}) {
  await requireAdminSession("/admin/payments", [...ADMIN_FINANCE_ROLES]);
  const { status, provider, attention, page } = await searchParams;
  const activeStatus = STATUS_FILTERS.find((f) => f.value === status)?.value;
  const activeProvider = PROVIDER_FILTERS.find((f) => f.value === provider)?.value;
  const requiresAttention = attention === "1";
  const currentPage = parsePage(page);

  const { rows: payments, total, pageSize } = await paymentsService.listForAdmin(
    {
      status: activeStatus as "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | undefined,
      provider: activeProvider,
      requiresAttention: requiresAttention || undefined,
    },
    currentPage,
  );

  const withParam = (key: "status" | "provider", value: string | undefined) => {
    const params = new URLSearchParams();
    if (key === "status" ? value : status) params.set("status", key === "status" ? value! : status!);
    if (key === "provider" ? value : provider) params.set("provider", key === "provider" ? value! : provider!);
    const qs = params.toString();
    return qs ? `/admin/payments?${qs}` : "/admin/payments";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payments" description={`${total} payment${total === 1 ? "" : "s"}.`} />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={withParam("status", filter.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeStatus === filter.value && !requiresAttention
                ? "bg-espresso-800 text-white"
                : "bg-ivory-50 text-espresso-900/65 ring-1 ring-ivory-300 hover:bg-ivory-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
        <Link
          href="/admin/payments?attention=1"
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
            requiresAttention ? "bg-danger-600 text-white" : "bg-ivory-50 text-danger-600 ring-1 ring-danger-200 hover:bg-danger-50"
          }`}
        >
          Requires attention
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROVIDER_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={withParam("provider", filter.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeProvider === filter.value
                ? "bg-espresso-900 text-white"
                : "bg-ivory-50 text-espresso-900/65 ring-1 ring-ivory-300 hover:bg-ivory-50"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {payments.length === 0 ? (
        <EmptyState title="No payments found" description="Try a different status or provider filter." />
      ) : (
        <Card as="div" padded={false} className="divide-y divide-ivory-100">
          {payments.map((p) => (
            <Link
              key={p.id}
              href={`/admin/payments/${p.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">{p.reference}</p>
                <p className="text-xs text-espresso-900/50">
                  Order {p.order.orderNumber} · {p.order.customerProfile.displayName} · {p.provider}
                  {" · "}
                  {p.method === "MOBILE_MONEY"
                    ? `Mobile Money${p.network ? ` (${p.network})` : ""}`
                    : p.method === "CARD"
                      ? `Card${p.cardBrand && p.cardLast4 ? ` (${p.cardBrand} •••• ${p.cardLast4})` : ""}`
                      : "Mock"}
                  {p.exceptionReason ? " · needs attention" : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-espresso-950">{formatPrice(p.amount.toNumber(), p.currency)}</span>
                <StatusBadge
                  tone={
                    p.exceptionReason
                      ? "danger"
                      : p.status === "SUCCEEDED"
                        ? "success"
                        : p.status === "FAILED" || p.status === "CANCELLED"
                          ? "neutral"
                          : "warning"
                  }
                >
                  {p.exceptionReason ? "Attention" : p.status}
                </StatusBadge>
              </div>
            </Link>
          ))}
        </Card>
      )}

      <Pagination
        currentPage={currentPage}
        total={total}
        pageSize={pageSize}
        basePath="/admin/payments"
        extraParams={{ status: activeStatus, provider: activeProvider, attention: requiresAttention ? "1" : undefined }}
      />
    </div>
  );
}
