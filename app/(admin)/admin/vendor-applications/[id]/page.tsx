import { notFound } from "next/navigation";
import { ApplicationDecisionForms } from "../../../../../components/admin/ApplicationDecisionForms";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { vendorApplicationsService } from "../../../../../modules/vendor-applications/service";
import { catalogueService } from "../../../../../modules/catalogue/service";
import { BeginReviewButton } from "../../../../../components/admin/BeginReviewButton";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { StatusBadge } from "../../../../../components/ui/StatusBadge";

type Params = { id: string };

export const metadata = { title: "Vendor application — Admin" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-espresso-900/50">{label}</dt>
      <dd className="text-right font-medium text-espresso-950">{value || "—"}</dd>
    </div>
  );
}

export default async function AdminVendorApplicationDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminSession("/admin/vendor-applications");
  const [application, categories] = await Promise.all([
    vendorApplicationsService.getForAdmin(id),
    catalogueService.listCategories(),
  ]);

  if (!application) {
    notFound();
  }

  const categoryNameBySlug = Object.fromEntries(categories.map((category) => [category.slug, category.name]));

  const reviewable = ["SUBMITTED", "UNDER_REVIEW"].includes(application.status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={application.displayName ?? application.applicant.name}
        description={`${application.applicant.name} · ${application.applicant.email}`}
        actions={<StatusBadge tone="neutral">{application.status.replace(/_/g, " ")}</StatusBadge>}
      />

      <Card>
        <dl className="divide-y divide-ivory-100">
          <Row label="Seller type" value={application.sellerType ?? ""} />
          <Row label="Contact" value={`${application.contactName ?? ""} · ${application.contactPhone ?? ""}`} />
          <Row label="Store description" value={application.storeDescription ?? ""} />
          <Row label="Registration number" value={application.registrationNumber ?? ""} />
          <Row label="Tax identifier" value={application.taxIdentifier ?? ""} />
          <Row label="Year established" value={application.yearEstablished ? String(application.yearEstablished) : ""} />
          <Row label="Website" value={application.websiteUrl ?? ""} />
          <Row
            label="Location"
            value={[application.city, application.region, application.country].filter(Boolean).join(", ")}
          />
          <Row label="Address" value={application.addressLine1 ?? ""} />
          <Row
            label="Categories"
            value={application.categorySlugs.map((slug) => categoryNameBySlug[slug] ?? slug).join(", ")}
          />
          <Row label="Selling mode" value={application.sellingMode ?? ""} />
          <Row label="Bulk capable" value={application.bulkCapable ? "Yes" : "No"} />
          <Row label="Service areas" value={application.serviceAreas ?? ""} />
        </dl>
      </Card>

      {reviewable ? (
        <>
          {application.status === "SUBMITTED" ? <BeginReviewButton applicationId={application.id} /> : null}
          <ApplicationDecisionForms applicationId={application.id} />
        </>
      ) : (
        <Card className="text-sm text-espresso-900/65">
          This application is {application.status.toLowerCase().replace("_", " ")}
          {application.decisionReason ? ` — ${application.decisionReason}` : ""}.
        </Card>
      )}
    </div>
  );
}
