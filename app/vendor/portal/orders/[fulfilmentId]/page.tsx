import { notFound } from "next/navigation";
import { FulfilmentStatusBadge } from "../../../../../components/fulfilment/FulfilmentStatusBadge";
import { Card } from "../../../../../components/ui/Card";
import { Alert } from "../../../../../components/ui/Alert";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import {
  StartPreparingButton,
  MarkReadyButton,
  ReportIssueForm,
  RecordShipmentForm,
} from "../../../../../components/vendor-portal/FulfilmentActions";
import { requireVendorPortalContext } from "../../../../../modules/vendors/policy";
import { fulfilmentService } from "../../../../../modules/fulfilment/service";
import { resolutionsService } from "../../../../../modules/resolutions/service";

type Params = { fulfilmentId: string };

const OPEN_CASE_STATUSES = new Set(["OPEN", "UNDER_REVIEW", "AWAITING_CUSTOMER", "AWAITING_VENDOR", "RESOLUTION_APPROVED", "RESOLUTION_IN_PROGRESS"]);

export const metadata = { title: "Order — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorFulfilmentDetailPage({ params }: { params: Promise<Params> }) {
  const { fulfilmentId } = await params;
  const { vendorId } = await requireVendorPortalContext(`/vendor/portal/orders/${fulfilmentId}`);
  const fulfilment = await fulfilmentService.getDetailForVendor(vendorId, fulfilmentId);

  if (!fulfilment) {
    notFound();
  }

  const international = fulfilment.origin === "INTERNATIONAL_INBOUND";

  // (M11.1) A Buyer/CrownSource-managed case may hold this order in review
  // without the vendor having reported anything themselves (that's the
  // separate openIssue/FulfilmentIssue mechanism below) — surface it so the
  // vendor isn't left guessing why a delivered package still shows activity.
  const allCases = await resolutionsService.listForVendor(vendorId);
  const openCase = allCases.find((c) => c.fulfilmentId === fulfilment.id && OPEN_CASE_STATUSES.has(c.status));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={fulfilment.orderNumber}
        description={`${fulfilment.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${international ? " · International" : " · Domestic collection"}`}
        actions={<FulfilmentStatusBadge status={fulfilment.status} />}
      />

      {fulfilment.openIssue ? (
        <Alert tone="danger" title="Issue reported">
          {fulfilment.openIssue.description}
          <br />
          <span className="text-xs">CrownSourceGlobal operations has been notified and will follow up.</span>
        </Alert>
      ) : null}

      <Card>
        <h2 className="font-display text-lg font-medium text-espresso-950">What to prepare</h2>
        <ul className="mt-3 divide-y divide-ivory-100">
          {fulfilment.items.map((item) => (
            <li key={item.id} className="flex justify-between py-2.5 text-sm">
              <span className="text-espresso-800">{item.description}</span>
              <span className="font-medium text-espresso-950">× {item.quantity}</span>
            </li>
          ))}
        </ul>
        {fulfilment.leadTimeDaysDefault ? (
          <p className="mt-3 text-xs text-espresso-900/50">Your typical lead time: {fulfilment.leadTimeDaysDefault} days.</p>
        ) : null}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-medium text-espresso-950">
          {international ? "Where to ship" : "How CrownSource will receive it"}
        </h2>
        {international ? (
          fulfilment.shipment?.receivingLocation ? (
            <div className="mt-3 text-sm text-espresso-800">
              <p className="font-medium text-espresso-950">{fulfilment.shipment.receivingLocation.name}</p>
              <p>{fulfilment.shipment.receivingLocation.addressLine1}</p>
              <p>
                {[fulfilment.shipment.receivingLocation.city, fulfilment.shipment.receivingLocation.region, fulfilment.shipment.receivingLocation.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {fulfilment.shipment.receivingLocation.contactName ? (
                <p className="mt-1 text-espresso-900/50">
                  Contact: {fulfilment.shipment.receivingLocation.contactName} · {fulfilment.shipment.receivingLocation.contactPhone}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-espresso-900/50">
              CrownSourceGlobal hasn&apos;t assigned a receiving destination yet — check back before shipping.
            </p>
          )
        ) : (
          <p className="mt-3 text-sm text-espresso-800">
            Once you mark this order ready, CrownSourceGlobal operations will arrange collection from your registered
            pickup location. Keep your pickup details up to date in{" "}
            <a href="/vendor/portal/store" className="text-forest-800 underline">
              Store profile
            </a>
            .
          </p>
        )}
      </Card>

      {fulfilment.status === "PENDING" ? (
        <StartPreparingButton fulfilmentId={fulfilment.id} />
      ) : fulfilment.status === "PREPARING" ? (
        <MarkReadyButton fulfilmentId={fulfilment.id} international={international} />
      ) : fulfilment.status === "READY" && international ? (
        <Card>
          <h2 className="font-display text-lg font-medium text-espresso-950">Record your shipment</h2>
          <p className="mt-1 text-sm text-espresso-900/50">Enter your carrier and tracking details once you&apos;ve shipped it.</p>
          <div className="mt-4">
            <RecordShipmentForm fulfilmentId={fulfilment.id} />
          </div>
        </Card>
      ) : fulfilment.status === "READY" ? (
        <Alert tone="success">Ready for collection — CrownSourceGlobal will arrange pickup.</Alert>
      ) : fulfilment.status === "DISPATCHED" ? (
        <Alert tone="success">
          {international ? "Shipped — awaiting receipt by CrownSourceGlobal." : "Collected — on its way to the customer."}
        </Alert>
      ) : fulfilment.status === "DELIVERED" || fulfilment.status === "COMPLETED" ? (
        <Alert tone="success">Delivered to the customer.</Alert>
      ) : null}

      {["PENDING", "PREPARING", "READY"].includes(fulfilment.status) && !fulfilment.openIssue ? (
        <ReportIssueForm fulfilmentId={fulfilment.id} />
      ) : null}
    </div>
  );
}
