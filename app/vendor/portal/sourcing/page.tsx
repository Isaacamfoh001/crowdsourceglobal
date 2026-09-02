import Link from "next/link";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { Card } from "../../../../components/ui/Card";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Pagination } from "../../../../components/shared/Pagination";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { sourcingService } from "../../../../modules/sourcing/service";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Sourcing requests — Vendor Portal" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  SENT: "Awaiting your response",
  RESPONDED: "You responded — can fulfil",
  CANNOT_FULFIL: "You responded — cannot fulfil",
};

export default async function VendorSourcingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/sourcing");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows, total, pageSize } = await sourcingService.listSolicitationsForVendor(vendorId, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sourcing requests"
        description="Custom sourcing requests CrownSourceGlobal has asked you to quote."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No sourcing requests yet"
          description="CrownSourceGlobal will send you a request here when it matches what you supply."
        />
      ) : (
        <Card as="div" padded={false} className="divide-y divide-ivory-100">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/vendor/portal/sourcing/${row.id}`}
              className="flex flex-col gap-2 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-espresso-950">{row.requestTitle}</p>
                <p className="text-xs text-espresso-900/50">
                  {row.requestReference} · {row.quantity} {row.quantityUnit ?? ""} ·{" "}
                  {row.sentAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  row.status === "SENT"
                    ? "bg-champagne-200/40 text-espresso-800"
                    : row.status === "RESPONDED"
                      ? "bg-green-100 text-green-800"
                      : "bg-ivory-200 text-espresso-900/50"
                }`}
              >
                {STATUS_LABEL[row.status]}
              </span>
            </Link>
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/vendor/portal/sourcing" />
    </div>
  );
}
