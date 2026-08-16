import { notFound } from "next/navigation";
import { ApplicationDecisionForms } from "../../../../../components/admin/ApplicationDecisionForms";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { vendorApplicationsService } from "../../../../../modules/vendor-applications/service";
import { BeginReviewButton } from "../../../../../components/admin/BeginReviewButton";

type Params = { id: string };

export const metadata = { title: "Vendor application — Admin" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-900">{value || "—"}</dd>
    </div>
  );
}

export default async function AdminVendorApplicationDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminSession("/admin/vendor-applications");
  const application = await vendorApplicationsService.getForAdmin(id);

  if (!application) {
    notFound();
  }

  const reviewable = ["SUBMITTED", "UNDER_REVIEW"].includes(application.status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">
          {application.displayName ?? application.applicant.name}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {application.applicant.name} · {application.applicant.email}
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <dl className="divide-y divide-stone-100">
          <Row label="Status" value={application.status} />
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
          <Row label="Categories" value={application.categorySlugs.join(", ")} />
          <Row label="Selling mode" value={application.sellingMode ?? ""} />
          <Row label="Bulk capable" value={application.bulkCapable ? "Yes" : "No"} />
          <Row label="Service areas" value={application.serviceAreas ?? ""} />
        </dl>
      </div>

      {reviewable ? (
        <>
          {application.status === "SUBMITTED" ? <BeginReviewButton applicationId={application.id} /> : null}
          <ApplicationDecisionForms applicationId={application.id} />
        </>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600">
          This application is {application.status.toLowerCase().replace("_", " ")}
          {application.decisionReason ? ` — ${application.decisionReason}` : ""}.
        </div>
      )}
    </div>
  );
}
