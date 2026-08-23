import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { SeverityBadge } from "./SeverityBadge";
import { EmptyState } from "../../ui/EmptyState";
import { Card } from "../../ui/Card";
import type { AttentionItem } from "../../../modules/admin-dashboard/types";
import type { AttentionSeverity } from "../../../modules/operations/policy";

const MODULE_LABELS: Record<AttentionItem["module"], string> = {
  OPERATIONS: "Operations",
  SOURCING: "Sourcing",
  MESSAGES: "Messages",
  VENDOR_APPLICATIONS: "Vendor applications",
  LISTINGS: "Listings",
  QUOTATIONS: "Quotations",
  RESOLUTIONS: "Resolutions",
  PAYMENTS: "Payments",
  FINANCE: "Finance",
};

/** Left accent stripe by severity — lets an operator scan the queue for critical rows without reading every badge. */
const SEVERITY_ACCENT: Record<AttentionSeverity, string> = {
  CRITICAL: "border-l-danger-600",
  NEEDS_ATTENTION: "border-l-champagne-600",
  NORMAL: "border-l-transparent",
};

export function AttentionList({ items, emptyMessage }: { items: AttentionItem[]; emptyMessage: string }) {
  if (items.length === 0) {
    return <EmptyState icon={CheckCircle2} title="All clear" description={emptyMessage} />;
  }

  return (
    <Card as="ul" padded={false} className="divide-y divide-ivory-100">
      {items.map((item, index) => (
        <li key={`${item.type}-${item.targetUrl}-${index}`}>
          <Link
            href={item.targetUrl}
            className={`flex flex-col gap-2 border-l-4 px-4 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${SEVERITY_ACCENT[item.severity]}`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-espresso-950">{item.reference}</p>
              <p className="mt-0.5 truncate text-sm text-espresso-900/65">{item.description}</p>
              <p className="mt-1 text-xs text-espresso-900/35">
                {MODULE_LABELS[item.module]} · {item.status}
                {item.assignedTo ? ` · ${item.assignedTo}` : ""} · {item.ageLabel}
              </p>
            </div>
            <div className="shrink-0">
              <SeverityBadge severity={item.severity} />
            </div>
          </Link>
        </li>
      ))}
    </Card>
  );
}
