import { notFound } from "next/navigation";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { serviceRequestsService } from "../../../../../modules/service-requests/service";
import { serviceRequestImageUrl } from "../../../../../lib/service-request-images";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { BackLink } from "../../../../../components/ui/BackLink";
import { StatusBadge } from "../../../../../components/ui/StatusBadge";
import type { BadgeTone } from "../../../../../components/ui/Badge";

type Params = { id: string };

export const metadata = { title: "Service request — Admin" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = {
  SUBMITTED: "gold",
  PROVIDER_ACCEPTED: "success",
  PROVIDER_DECLINED: "danger",
  CANCELLED: "neutral",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-espresso-900/50">{label}</dt>
      <dd className="text-right font-medium text-espresso-950">{value || "—"}</dd>
    </div>
  );
}

/** Read-only admin visibility (M22 §15) — no accept/decline action here, that belongs to the provider. */
export default async function AdminServiceRequestDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminSession("/admin/service-requests");
  const request = await serviceRequestsService.getForAdmin(id);

  if (!request) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/service-requests" label="Back to service requests" />

      <PageHeader title={request.service.name} description={`Requested from ${request.professional.name}`} />

      <StatusBadge tone={STATUS_TONE[request.status] ?? "neutral"} className="w-fit">
        {request.status.replaceAll("_", " ")}
      </StatusBadge>

      <Card>
        <dl className="divide-y divide-ivory-100">
          <Row label="Customer" value={request.customer.name} />
          <Row label="Preferred date" value={new Date(request.preferredDate).toLocaleDateString()} />
          <Row label="Time preference" value={request.preferredTimeNote ?? ""} />
          <Row label="Location" value={request.locationMode.replaceAll("_", " ")} />
          <Row label="Location details" value={request.locationDetails ?? ""} />
          <Row label="Quantity" value={String(request.quantity)} />
          <Row label="Notes" value={request.notes ?? ""} />
          {request.declineReason ? <Row label="Decline reason" value={request.declineReason} /> : null}
        </dl>
      </Card>

      {request.referenceImage ? (
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.15em] text-espresso-900/50 uppercase">Reference photo</p>
          <div className="overflow-hidden rounded-lg border border-ivory-300 bg-ivory-200">
            {/* eslint-disable-next-line @next/next/no-img-element -- storage-backed photo, not Next's image optimizer */}
            <img src={serviceRequestImageUrl(request.referenceImage)} alt="Customer reference" className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
