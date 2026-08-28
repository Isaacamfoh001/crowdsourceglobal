import { EmptyState } from "../../../../components/ui/EmptyState";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { Pagination } from "../../../../components/shared/Pagination";
import { requireSession } from "../../../../modules/identity/policy";
import { serviceRequestsService } from "../../../../modules/service-requests/service";
import { parsePage } from "../../../../lib/pagination";
import type { BadgeTone } from "../../../../components/ui/Badge";

export const metadata = { title: "Your service requests" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = {
  SUBMITTED: "gold",
  PROVIDER_ACCEPTED: "success",
  PROVIDER_DECLINED: "danger",
  CANCELLED: "neutral",
};

/**
 * Customer request history (M22 §17). Read-only on web — requests are
 * submitted from the CrownSourceGlobal mobile app (Beauty Services'
 * primary surface, same "creation is mobile-only" precedent Explore posts
 * already established); this page exists so the notification-email CTA
 * lands somewhere real, and so the web Account area stays a complete
 * mirror of what's happening on a customer's account.
 */
export default async function ServiceRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireSession("/account/service-requests");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: requests, total, pageSize } = await serviceRequestsService.listForCustomer(session.user.id, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-espresso-950">Your service requests</h1>
        <p className="mt-1 text-sm text-espresso-900/50">Beauty Services requests you&apos;ve submitted from the CrownSourceGlobal app.</p>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No service requests yet"
          description="Browse Beauty Professionals and request a service from the CrownSourceGlobal mobile app."
        />
      ) : (
        <div className="divide-y divide-ivory-200 border-t border-ivory-300">
          {requests.map((request) => (
            <div key={request.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-2">
              <div>
                <p className="text-sm font-medium text-espresso-950">
                  {request.service.name} — {request.professional.name}
                </p>
                <p className="text-xs text-espresso-900/50">
                  Preferred {request.preferredDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <StatusBadge tone={STATUS_TONE[request.status] ?? "neutral"} className="w-fit">
                {request.status.replaceAll("_", " ")}
              </StatusBadge>
            </div>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/account/service-requests" />
    </div>
  );
}
