import { notFound } from "next/navigation";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { BackLink } from "../../../../../components/ui/BackLink";
import { AttachmentGallery } from "../../../../../components/sourcing/AttachmentGallery";
import { RespondToSolicitationForm } from "../../../../../components/vendor-portal/SourcingSolicitationActions";
import { requireVendorPortalContext } from "../../../../../modules/vendors/policy";
import { sourcingService } from "../../../../../modules/sourcing/service";
import { formatPrice } from "../../../../../lib/format";

type Params = { id: string };

export const metadata = { title: "Sourcing request — Vendor Portal" };
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function VendorSolicitationDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const { vendorId } = await requireVendorPortalContext(`/vendor/portal/sourcing/${id}`);
  const solicitation = await sourcingService.getSolicitationDetailForVendor(id, vendorId);
  if (!solicitation) notFound();

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/vendor/portal/sourcing" label="Back to sourcing requests" />

      <PageHeader
        title={solicitation.title}
        description={`${solicitation.requestReference} · Received ${formatDate(solicitation.sentAt)}`}
      />

      <Card>
        <p className="whitespace-pre-line text-sm leading-relaxed text-espresso-800">{solicitation.description}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-espresso-900/50">Quantity requested</p>
            <p className="mt-0.5 font-medium text-espresso-950">
              {solicitation.quantity} {solicitation.quantityUnit ?? ""}
            </p>
          </div>
          <div>
            <p className="text-espresso-900/50">Delivery location</p>
            <p className="mt-0.5 font-medium text-espresso-950">
              {[solicitation.deliveryCity, solicitation.deliveryRegion, solicitation.deliveryCountry].filter(Boolean).join(", ")}
            </p>
          </div>
          {solicitation.requiredByDate ? (
            <div>
              <p className="text-espresso-900/50">Needed by</p>
              <p className="mt-0.5 font-medium text-espresso-950">{formatDate(solicitation.requiredByDate)}</p>
            </div>
          ) : null}
        </div>
        {solicitation.specifications && Object.keys(solicitation.specifications).length > 0 ? (
          <dl className="mt-4 divide-y divide-ivory-100 rounded-xl border border-ivory-300">
            {Object.entries(solicitation.specifications).map(([key, value]) => (
              <div key={key} className="flex justify-between px-4 py-2.5 text-sm">
                <dt className="text-espresso-900/50">{key}</dt>
                <dd className="font-medium text-espresso-950">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {solicitation.attachments.length > 0 ? (
          <div className="mt-4">
            <AttachmentGallery attachments={solicitation.attachments} />
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="font-display text-base font-medium text-espresso-950">Your response</h2>
        <div className="mt-3">
          {solicitation.status === "SENT" ? (
            <RespondToSolicitationForm id={solicitation.id} />
          ) : solicitation.status === "CANNOT_FULFIL" ? (
            <p className="text-sm text-espresso-900/65">You reported that you can&apos;t fulfil this request.</p>
          ) : (
            <div className="text-sm text-espresso-900/75">
              <p className="font-medium text-espresso-950">
                {solicitation.response?.proposedQuantity?.toLocaleString()} units ·{" "}
                {formatPrice(solicitation.response?.unitPrice ?? 0, solicitation.response?.currency ?? "GHS")}/unit
              </p>
              <p className="mt-1 text-espresso-900/50">
                {solicitation.response?.leadTimeDays ? `${solicitation.response.leadTimeDays} days lead time` : "Lead time not specified"}
              </p>
              {solicitation.response?.notes ? <p className="mt-2 italic">&ldquo;{solicitation.response.notes}&rdquo;</p> : null}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
