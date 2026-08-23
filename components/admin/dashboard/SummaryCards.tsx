import Link from "next/link";
import type { SummaryCounts } from "../../../modules/admin-dashboard/types";

type Card = { label: string; count: number; href: string; emphasize?: boolean };

export function SummaryCards({ summary, operationalAllowed }: { summary: SummaryCounts; operationalAllowed: boolean }) {
  const cards: Card[] = [
    { label: "Pending vendor applications", count: summary.pendingVendorApplications, href: "/admin/vendor-applications" },
    { label: "Listings awaiting review", count: summary.listingsAwaitingReview, href: "/admin/listings" },
    { label: "Active sourcing requests", count: summary.activeSourcingRequests, href: "/admin/sourcing" },
    ...(operationalAllowed
      ? ([
          { label: "Ready for collection", count: summary.readyForCollection, href: "/admin/operations?status=READY" },
          { label: "Delivery issues", count: summary.deliveryIssues, href: "/admin/operations?status=EXCEPTION", emphasize: summary.deliveryIssues > 0 },
          { label: "Unanswered conversations", count: summary.unansweredConversations, href: "/admin/messages" },
          { label: "Open resolution cases", count: summary.openResolutionCases, href: "/admin/resolutions" },
          { label: "Returns awaiting inspection", count: summary.returnsAwaitingInspection, href: "/admin/resolutions" },
          { label: "Refunds pending", count: summary.refundsPending, href: "/admin/resolutions" },
        ] satisfies Card[])
      : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.href}
          className={`rounded-2xl border bg-white p-4 transition-colors hover:bg-ivory-50 ${
            card.emphasize ? "border-danger-200 bg-danger-50/50" : "border-ivory-300"
          }`}
        >
          <p className={`font-display text-2xl font-medium ${card.emphasize ? "text-danger-700" : "text-espresso-950"}`}>{card.count}</p>
          <p className="mt-1 text-xs text-espresso-900/50">{card.label}</p>
        </Link>
      ))}
    </div>
  );
}
