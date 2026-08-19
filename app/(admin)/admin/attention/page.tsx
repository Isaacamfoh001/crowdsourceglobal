import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { adminDashboardService } from "../../../../modules/admin-dashboard/service";
import { AttentionList } from "../../../../components/admin/dashboard/AttentionList";
import type { AttentionModule, AttentionType } from "../../../../modules/admin-dashboard/types";
import type { AttentionSeverity } from "../../../../modules/operations/policy";

export const metadata = { title: "Attention required — Admin" };
export const dynamic = "force-dynamic";

const TYPE_FILTERS: { value: AttentionType; label: string }[] = [
  { value: "DELIVERY_ISSUE", label: "Delivery issue" },
  { value: "FULFILMENT_OVERDUE", label: "Fulfilment overdue" },
  { value: "INTERNATIONAL_AWAITING_RECEIPT", label: "Awaiting receipt" },
  { value: "SOURCING_UNASSIGNED", label: "Sourcing unassigned" },
  { value: "SOURCING_STALE", label: "Sourcing stale" },
  { value: "SOURCING_DEADLINE_RISK", label: "Sourcing deadline risk" },
  { value: "MESSAGE_UNANSWERED", label: "Message unanswered" },
  { value: "VENDOR_APPLICATION_PENDING", label: "Vendor application" },
  { value: "LISTING_MODERATION_PENDING", label: "Listing review" },
  { value: "QUOTATION_NEARING_EXPIRY", label: "Quote nearing expiry" },
  { value: "RESOLUTION_UNASSIGNED", label: "Case unassigned" },
  { value: "RESOLUTION_STALE", label: "Case stale" },
  { value: "VENDOR_RESPONSE_OVERDUE", label: "Vendor response overdue" },
  { value: "RETURN_AWAITING_INSPECTION", label: "Return awaiting inspection" },
  { value: "REFUND_FAILED", label: "Refund failed" },
  { value: "PAYMENT_EXCEPTION", label: "Payment exception" },
  { value: "ELIGIBLE_EARNINGS_UNSETTLED_TOO_LONG", label: "Eligible earnings unsettled" },
  { value: "SETTLEMENT_APPROVED_AWAITING_PAYOUT", label: "Settlement awaiting payout" },
  { value: "VENDOR_NEGATIVE_BALANCE", label: "Vendor negative balance" },
];

const SEVERITY_FILTERS: { value: AttentionSeverity; label: string }[] = [
  { value: "CRITICAL", label: "Critical" },
  { value: "NEEDS_ATTENTION", label: "Needs attention" },
];

const MODULE_FILTERS: { value: AttentionModule; label: string }[] = [
  { value: "OPERATIONS", label: "Operations" },
  { value: "SOURCING", label: "Sourcing" },
  { value: "MESSAGES", label: "Messages" },
  { value: "VENDOR_APPLICATIONS", label: "Vendor applications" },
  { value: "LISTINGS", label: "Listings" },
  { value: "QUOTATIONS", label: "Quotations" },
  { value: "RESOLUTIONS", label: "Resolutions" },
  { value: "PAYMENTS", label: "Payments" },
  { value: "FINANCE", label: "Finance" },
];

type SearchParams = { type?: string; severity?: string; module?: string; assigned?: string; page?: string };

function buildHref(current: SearchParams, changes: Partial<SearchParams>): string {
  const merged = { ...current, ...changes, page: changes.page ?? undefined };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/admin/attention?${qs}` : "/admin/attention";
}

export default async function AdminAttentionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { admin } = await requireAdminSession("/admin/attention");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const assigned = params.assigned === "assigned" || params.assigned === "unassigned" ? params.assigned : undefined;

  const { items, total, pageSize } = await adminDashboardService.getAttentionQueue(
    admin.role,
    { type: params.type, severity: params.severity, module: params.module, assigned },
    page,
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">Attention required</h1>
        <p className="mt-1 text-sm text-stone-500">{total} item{total === 1 ? "" : "s"} need CrownSource action.</p>
      </div>

      <div className="flex flex-col gap-3">
        <FilterRow label="Severity" current={params}>
          <FilterLink href={buildHref(params, { severity: undefined })} active={!params.severity}>All</FilterLink>
          {SEVERITY_FILTERS.map((f) => (
            <FilterLink key={f.value} href={buildHref(params, { severity: f.value })} active={params.severity === f.value}>
              {f.label}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow label="Type" current={params}>
          <FilterLink href={buildHref(params, { type: undefined })} active={!params.type}>All</FilterLink>
          {TYPE_FILTERS.map((f) => (
            <FilterLink key={f.value} href={buildHref(params, { type: f.value })} active={params.type === f.value}>
              {f.label}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow label="Module" current={params}>
          <FilterLink href={buildHref(params, { module: undefined })} active={!params.module}>All</FilterLink>
          {MODULE_FILTERS.map((f) => (
            <FilterLink key={f.value} href={buildHref(params, { module: f.value })} active={params.module === f.value}>
              {f.label}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow label="Assignment" current={params}>
          <FilterLink href={buildHref(params, { assigned: undefined })} active={!params.assigned}>All</FilterLink>
          <FilterLink href={buildHref(params, { assigned: "unassigned" })} active={params.assigned === "unassigned"}>Unassigned</FilterLink>
          <FilterLink href={buildHref(params, { assigned: "assigned" })} active={params.assigned === "assigned"}>Assigned</FilterLink>
        </FilterRow>
      </div>

      <AttentionList items={items} emptyMessage="No items match this filter." />

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <Link
            href={buildHref(params, { page: String(Math.max(1, page - 1)) })}
            aria-disabled={page <= 1}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${page <= 1 ? "pointer-events-none border-stone-200 text-stone-300" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
          >
            Previous
          </Link>
          <span className="text-sm text-stone-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={buildHref(params, { page: String(Math.min(totalPages, page + 1)) })}
            aria-disabled={page >= totalPages}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium ${page >= totalPages ? "pointer-events-none border-stone-200 text-stone-300" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; current: SearchParams; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-xs font-medium tracking-wide text-stone-400 uppercase">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}
    >
      {children}
    </Link>
  );
}
