import Link from "next/link";
import { SeverityBadge } from "./SeverityBadge";
import type { AttentionItem } from "../../../modules/admin-dashboard/types";

const MODULE_LABELS: Record<AttentionItem["module"], string> = {
  OPERATIONS: "Operations",
  SOURCING: "Sourcing",
  MESSAGES: "Messages",
  VENDOR_APPLICATIONS: "Vendor applications",
  LISTINGS: "Listings",
  QUOTATIONS: "Quotations",
  RESOLUTIONS: "Resolutions",
  PAYMENTS: "Payments",
};

export function AttentionList({ items, emptyMessage }: { items: AttentionItem[]; emptyMessage: string }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <p className="text-sm text-stone-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
      {items.map((item, index) => (
        <li key={`${item.type}-${item.targetUrl}-${index}`}>
          <Link
            href={item.targetUrl}
            className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900">{item.reference}</p>
              <p className="mt-0.5 truncate text-sm text-stone-600">{item.description}</p>
              <p className="mt-1 text-xs text-stone-400">
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
    </ul>
  );
}
