import Link from "next/link";
import { Button } from "../../../../components/ui/Button";
import { SourcingStatusBadge } from "../../../../components/sourcing/SourcingStatusBadge";
import { requireSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { sourcingService } from "../../../../modules/sourcing/service";

export const metadata = { title: "Your sourcing requests" };
export const dynamic = "force-dynamic";

export default async function SourcingRequestsPage() {
  const session = await requireSession("/account/sourcing");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  const requests = customerProfile ? await sourcingService.listForCustomer(customerProfile.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">Your sourcing requests</h1>
          <p className="mt-1 text-sm text-stone-500">Custom requirements CrownSourceGlobal is sourcing for you.</p>
        </div>
        <Link href="/sourcing/new">
          <Button size="sm">New request</Button>
        </Link>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-sm text-stone-500">You haven&apos;t submitted a sourcing request yet.</p>
          <Link href="/sourcing/new">
            <Button variant="outline" className="mt-4">
              Start a request
            </Button>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {requests.map((request) => (
            <Link
              key={request.id}
              href={`/account/sourcing/${request.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-stone-900">{request.title}</p>
                <p className="text-xs text-stone-500">
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
    </div>
  );
}
