import Link from "next/link";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { vendorApplicationsService } from "../../../../modules/vendor-applications/service";
import { SELLER_TYPES } from "../../../../modules/vendor-applications/types";
import { manufacturerApplicationsService } from "../../../../modules/manufacturer-applications/service";
import { catalogueService } from "../../../../modules/catalogue/service";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { Card } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";

export const metadata = { title: "Vendor applications — Admin" };
export const dynamic = "force-dynamic";

/**
 * M32.7 — a "type" tab, not a separate route: new-applicant Manufacturer
 * applications are still plain VendorApplication rows (sellerType =
 * MANUFACTURER), so that queue stays part of this one list with a filter
 * rather than a second admin section.
 *
 * M32.8 — the Manufacturers tab additionally shows "Seller upgrade
 * requests": ManufacturerApplication rows belonging to an already-APPROVED
 * Vendor requesting the additional capability (see that model's doc
 * comment for why this is a second table rather than a VendorApplication
 * mutation). Both sources are shown on this one tab — an admin should never
 * have to hunt elsewhere to find either kind of manufacturer request — but
 * they're kept in clearly labeled sections since they're different rows
 * with a different detail/approval surface.
 */
const MANUFACTURER_TYPE = "MANUFACTURER";
const SELLER_TAB_TYPES = SELLER_TYPES.filter((t) => t.value !== MANUFACTURER_TYPE).map((t) => t.value);

const TYPE_TABS = [
  { value: undefined, label: "All" },
  { value: "sellers", label: "Sellers" },
  { value: "manufacturers", label: "Manufacturers" },
] as const;

export default async function AdminVendorApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  await requireAdminSession("/admin/vendor-applications");
  const { page, type } = await searchParams;
  const currentPage = parsePage(page);
  const activeTab = TYPE_TABS.find((t) => t.value === type)?.value;
  const sellerTypes = activeTab === "manufacturers" ? [MANUFACTURER_TYPE] : activeTab === "sellers" ? SELLER_TAB_TYPES : undefined;
  const onManufacturersTab = activeTab === "manufacturers";

  const [{ rows: applications, total, pageSize }, upgradeRequests, categories] = await Promise.all([
    vendorApplicationsService.listForAdminPaginated(undefined, currentPage, sellerTypes),
    onManufacturersTab ? manufacturerApplicationsService.listForAdminPaginated() : Promise.resolve({ rows: [], total: 0, pageSize: 0 }),
    onManufacturersTab ? catalogueService.listCategories() : Promise.resolve([]),
  ]);
  const categoryNameBySlug = Object.fromEntries(categories.map((category) => [category.slug, category.name]));

  const description =
    activeTab === "manufacturers"
      ? `${total} new application${total === 1 ? "" : "s"}, ${upgradeRequests.total} seller upgrade request${upgradeRequests.total === 1 ? "" : "s"}.`
      : activeTab === "sellers"
        ? `${total} seller application${total === 1 ? "" : "s"}.`
        : `${total} application${total === 1 ? "" : "s"}.`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Vendor applications" description={description} />

      <div className="flex flex-wrap gap-2">
        {TYPE_TABS.map((tab) => (
          <Link
            key={tab.label}
            href={{ pathname: "/admin/vendor-applications", query: tab.value ? { type: tab.value } : {} }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activeTab === tab.value ? "bg-espresso-800 text-white" : "bg-ivory-50 text-espresso-900/65 ring-1 ring-ivory-300 hover:bg-ivory-100"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {onManufacturersTab ? <h2 className="text-sm font-semibold text-espresso-900/70">New manufacturer applications</h2> : null}

      {applications.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description={
            activeTab === "manufacturers"
              ? "No new manufacturer applications awaiting review."
              : "No applications awaiting review."
          }
        />
      ) : (
        <Card as="ul" padded={false} className="divide-y divide-ivory-100">
          {applications.map((application) => {
            const location = [application.city, application.region, application.country].filter(Boolean).join(", ");
            const categoryLabel =
              application.categorySlugs.map((slug) => categoryNameBySlug[slug] ?? slug).join(", ") ||
              application.categoryOther ||
              "";

            return (
              <li key={application.id}>
                <Link
                  href={`/admin/vendor-applications/${application.id}`}
                  className="flex flex-col gap-1 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-espresso-950">{application.displayName ?? application.applicantName}</p>
                    <p className="text-xs text-espresso-900/50">
                      {application.applicantName} · {application.applicantEmail}
                    </p>
                    {activeTab === "manufacturers" ? (
                      <p className="mt-0.5 truncate text-xs text-espresso-900/50">
                        {[categoryLabel, location].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-espresso-900/50">
                    {activeTab === "manufacturers" && application.submittedAt ? (
                      <span>{application.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    ) : (
                      <span>{SELLER_TYPES.find((t) => t.value === application.sellerType)?.label ?? "—"}</span>
                    )}
                    <Badge tone="gold">{application.status}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/vendor-applications" extraParams={{ type: activeTab }} />

      {onManufacturersTab ? (
        <>
          <h2 className="mt-2 text-sm font-semibold text-espresso-900/70">Seller upgrade requests</h2>
          {upgradeRequests.rows.length === 0 ? (
            <EmptyState title="Nothing to review" description="No existing sellers have requested Manufacturer access." />
          ) : (
            <Card as="ul" padded={false} className="divide-y divide-ivory-100">
              {upgradeRequests.rows.map((request) => {
                const categoryLabel =
                  request.categorySlugs.map((slug) => categoryNameBySlug[slug] ?? slug).join(", ") || request.categoryOther || "";
                return (
                  <li key={request.id}>
                    <Link
                      href={`/admin/manufacturer-applications/${request.id}`}
                      className="flex flex-col gap-1 px-5 py-4 hover:bg-ivory-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-espresso-950">{request.vendorName}</p>
                        <p className="text-xs text-espresso-900/50">
                          Currently {SELLER_TYPES.find((t) => t.value === request.vendorSellerType)?.label ?? "—"}
                          {categoryLabel ? ` · ${categoryLabel}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-espresso-900/50">
                        {request.submittedAt ? (
                          <span>{request.submittedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        ) : null}
                        <Badge tone="gold">{request.status}</Badge>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
