import Link from "next/link";
import { Button } from "../../../../components/ui/Button";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { SourcingStatusBadge } from "../../../../components/sourcing/SourcingStatusBadge";
import { Pagination } from "../../../../components/shared/Pagination";
import { requireSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { sourcingService } from "../../../../modules/sourcing/service";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Your sourcing requests" };
export const dynamic = "force-dynamic";

export default async function SourcingRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireSession("/account/sourcing");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: requests, total, pageSize } = customerProfile
    ? await sourcingService.listForCustomer(customerProfile.id, currentPage)
    : { rows: [], total: 0, pageSize: 20 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-espresso-950">Your sourcing requests</h1>
          <p className="mt-1 text-sm text-espresso-900/50">Custom requirements CrownSourceGlobal is sourcing for you.</p>
        </div>
        <Link href="/sourcing/new">
          <Button size="sm">New request</Button>
        </Link>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No sourcing requests yet"
          description="You haven't submitted a sourcing request yet."
          actionHref="/sourcing/new"
          actionLabel="Start a request"
        />
      ) : (
        <div className="divide-y divide-ivory-200 border-t border-ivory-300">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/account/sourcing/${request.id}`}
              className="flex flex-col gap-2 py-4 transition-colors hover:bg-ivory-100/60 sm:flex-row sm:items-center sm:justify-between sm:px-2"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">{request.title}</p>
                <p className="text-xs text-espresso-900/50">
                  {request.requestNumber} ·{" "}
                  {request.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                  · {request.quantity} {request.quantityUnit ?? "units"}
                </p>
              </div>
              <SourcingStatusBadge status={request.status} label={request.statusLabel} />
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/account/sourcing" />
    </div>
  );
}
