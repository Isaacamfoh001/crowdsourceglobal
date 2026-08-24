import Link from "next/link";
import { requireSession, getCurrentCustomerProfile } from "../../../../modules/identity/policy";
import { resolutionsService } from "../../../../modules/resolutions/service";
import { CaseStatusBadge } from "../../../../components/resolutions/CaseStatusBadge";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Pagination } from "../../../../components/shared/Pagination";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Returns & Issues" };
export const dynamic = "force-dynamic";

export default async function ResolutionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await requireSession("/account/resolutions");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: cases, total, pageSize } = customerProfile
    ? await resolutionsService.listForCustomerPaginated(customerProfile.id, currentPage)
    : { rows: [], total: 0, pageSize: 20 };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-espresso-950">Returns & issues</h1>

      {cases.length === 0 ? (
        <EmptyState
          title="No returns or issues"
          description='Nothing here yet. If something went wrong with an order, open it and use "Report a problem".'
          actionHref="/account/orders"
          actionLabel="View your orders"
        />
      ) : (
        <div className="divide-y divide-ivory-200 border-t border-ivory-300">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/account/resolutions/${c.id}`}
              className="flex flex-col gap-2 py-4 transition-colors hover:bg-ivory-100/60 sm:flex-row sm:items-center sm:justify-between sm:px-2"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">{c.caseNumber}</p>
                <p className="text-xs text-espresso-900/50">
                  Order {c.orderNumber} ·{" "}
                  {c.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <CaseStatusBadge status={c.status} label={c.statusLabel} />
            </Link>
          ))}
        </div>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/account/resolutions" />
    </div>
  );
}
