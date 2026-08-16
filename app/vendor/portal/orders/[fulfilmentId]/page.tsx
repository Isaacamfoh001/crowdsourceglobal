import { notFound } from "next/navigation";
import { FulfilmentStatusBadge } from "../../../../../components/fulfilment/FulfilmentStatusBadge";
import { FormMessage } from "../../../../../components/ui/FormMessage";
import {
  StartPreparingButton,
  MarkReadyButton,
  ReportIssueForm,
  RecordShipmentForm,
} from "../../../../../components/vendor-portal/FulfilmentActions";
import { requireVendorPortalContext } from "../../../../../modules/vendors/policy";
import { fulfilmentService } from "../../../../../modules/fulfilment/service";

type Params = { fulfilmentId: string };

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">{fulfilment.orderNumber}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {fulfilment.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            {international ? " · International" : " · Domestic collection"}
          </p>
        </div>
        <FulfilmentStatusBadge status={fulfilment.status} />
      </div>

      {fulfilment.openIssue ? (
        <FormMessage tone="error">
          <span className="font-medium">Issue reported:</span> {fulfilment.openIssue.description}
          <br />
          <span className="text-xs">CrownSourceGlobal operations has been notified and will follow up.</span>
        </FormMessage>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-medium text-stone-900">What to prepare</h2>
        <ul className="mt-3 divide-y divide-stone-100">
          {fulfilment.items.map((item) => (
            <li key={item.id} className="flex justify-between py-2.5 text-sm">
              <span className="text-stone-700">{item.description}</span>
              <span className="font-medium text-stone-900">× {item.quantity}</span>
            </li>
          ))}
        </ul>
        {fulfilment.leadTimeDaysDefault ? (
          <p className="mt-3 text-xs text-stone-500">Your typical lead time: {fulfilment.leadTimeDaysDefault} days.</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="font-display text-lg font-medium text-stone-900">
          {international ? "Where to ship" : "How CrownSource will receive it"}
        </h2>
        {international ? (
          fulfilment.shipment?.receivingLocation ? (
            <div className="mt-3 text-sm text-stone-700">
              <p className="font-medium text-stone-900">{fulfilment.shipment.receivingLocation.name}</p>
              <p>{fulfilment.shipment.receivingLocation.addressLine1}</p>
              <p>
                {[fulfilment.shipment.receivingLocation.city, fulfilment.shipment.receivingLocation.region, fulfilment.shipment.receivingLocation.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {fulfilment.shipment.receivingLocation.contactName ? (
                <p className="mt-1 text-stone-500">
                  Contact: {fulfilment.shipment.receivingLocation.contactName} · {fulfilment.shipment.receivingLocation.contactPhone}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">
              CrownSourceGlobal hasn&apos;t assigned a receiving destination yet — check back before shipping.
            </p>
          )
        ) : (
          <p className="mt-3 text-sm text-stone-700">
            Once you mark this order ready, CrownSourceGlobal operations will arrange collection from your registered
            pickup location. Keep your pickup details up to date in{" "}
            <a href="/vendor/portal/store" className="text-brand-700 underline">
              Store profile
            </a>
            .
          </p>
        )}
      </div>

      {fulfilment.status === "PENDING" ? (
        <StartPreparingButton fulfilmentId={fulfilment.id} />
      ) : fulfilment.status === "PREPARING" ? (
        <MarkReadyButton fulfilmentId={fulfilment.id} international={international} />
      ) : fulfilment.status === "READY" && international ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="font-display text-lg font-medium text-stone-900">Record your shipment</h2>
          <p className="mt-1 text-sm text-stone-500">Enter your carrier and tracking details once you&apos;ve shipped it.</p>
          <div className="mt-4">
            <RecordShipmentForm fulfilmentId={fulfilment.id} />
          </div>
        </div>
      ) : fulfilment.status === "READY" ? (
        <FormMessage tone="success">Ready for collection — CrownSourceGlobal will arrange pickup.</FormMessage>
      ) : fulfilment.status === "DISPATCHED" ? (
        <FormMessage tone="success">
          {international ? "Shipped — awaiting receipt by CrownSourceGlobal." : "Collected — on its way to the customer."}
        </FormMessage>
      ) : fulfilment.status === "DELIVERED" || fulfilment.status === "COMPLETED" ? (
        <FormMessage tone="success">Delivered to the customer.</FormMessage>
      ) : null}

      {["PENDING", "PREPARING", "READY"].includes(fulfilment.status) && !fulfilment.openIssue ? (
        <ReportIssueForm fulfilmentId={fulfilment.id} />
      ) : null}
    </div>
  );
}
