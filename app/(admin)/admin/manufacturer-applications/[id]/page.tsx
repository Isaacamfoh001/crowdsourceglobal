import { notFound } from "next/navigation";
import { ManufacturerApplicationDecisionForms } from "../../../../../components/admin/ManufacturerApplicationDecisionForms";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { manufacturerApplicationsService } from "../../../../../modules/manufacturer-applications/service";
import { SELLER_TYPES } from "../../../../../modules/vendor-applications/types";
import { catalogueService } from "../../../../../modules/catalogue/service";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { StatusBadge } from "../../../../../components/ui/StatusBadge";
import { BackLink } from "../../../../../components/ui/BackLink";

type Params = { id: string };

export const metadata = { title: "Manufacturer upgrade request — Admin" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-espresso-900/50">{label}</dt>
      <dd className="text-right font-medium text-espresso-950">{value || "—"}</dd>
    </div>
  );
}

/**
 * M32.8 — an existing, already-APPROVED Vendor's request to add
 * Manufacturer capability. Deliberately shows the Vendor's existing
 * `sellerType` classification alongside the request so admin can see what
 * this Vendor already is — approval never changes that field (see
 * ManufacturerApplication's schema doc comment).
 */
export default async function AdminManufacturerApplicationDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminSession("/admin/manufacturer-applications");
  const [application, categories] = await Promise.all([
    manufacturerApplicationsService.getForAdmin(id),
    catalogueService.listCategories(),
  ]);

  if (!application) {
    notFound();
  }

  const categoryNameBySlug = Object.fromEntries(categories.map((category) => [category.slug, category.name]));
  const reviewable = ["SUBMITTED", "UNDER_REVIEW"].includes(application.status);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/vendor-applications?type=manufacturers" label="Back to Manufacturers" />

      <PageHeader
        title={application.vendor.companyName}
        description="Seller → Manufacturer upgrade request"
        actions={<StatusBadge tone="neutral">{application.status.replace(/_/g, " ")}</StatusBadge>}
      />

      <Card>
        <dl className="divide-y divide-ivory-100">
          <Row label="Existing classification" value={SELLER_TYPES.find((t) => t.value === application.vendor.sellerType)?.label ?? "—"} />
          <Row
            label="What they manufacture"
            value={application.categorySlugs.map((slug) => categoryNameBySlug[slug] ?? slug).join(", ")}
          />
          <Row label="Other (what they manufacture)" value={application.categoryOther ?? ""} />
        </dl>
      </Card>

      {reviewable ? (
        <ManufacturerApplicationDecisionForms applicationId={application.id} />
      ) : (
        <Card className="text-sm text-espresso-900/65">
          This application is {application.status.toLowerCase().replace("_", " ")}
          {application.decisionReason ? ` — ${application.decisionReason}` : ""}.
        </Card>
      )}
    </div>
  );
}
