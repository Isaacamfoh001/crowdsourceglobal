import { notFound } from "next/navigation";
import { FulfilmentStatusBadge } from "../../../../../components/fulfilment/FulfilmentStatusBadge";
import { FormMessage } from "../../../../../components/ui/FormMessage";
import {
  AssignReceivingLocationForm,
  ConfirmCollectionForm,
  ConfirmCollectedButton,
  ProgressButtons,
  ReportFailureForm,
  ResumeAfterFailureButton,
  ResolveIssueForm,
} from "../../../../../components/admin/OperationsActions";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { fulfilmentService } from "../../../../../modules/fulfilment/service";

type Params = { fulfilmentId: string };

export const metadata = { title: "Fulfilment — Operations" };
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-900">{value || "—"}</dd>
    </div>
  );
}

export default async function AdminFulfilmentDetailPage({ params }: { params: Promise<Params> }) {
  const { fulfilmentId } = await params;
  await requireAdminSession("/admin/operations", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const [fulfilment, locations] = await Promise.all([
    fulfilmentService.getDetailForAdmin(fulfilmentId),
    fulfilmentService.listActiveReceivingLocations(),
  ]);

  if (!fulfilment) {
    notFound();
  }

  const international = fulfilment.origin === "INTERNATIONAL_INBOUND";
  const shipmentStatus = fulfilment.shipment?.status ?? "CREATED";
  const awaitingHandoff = shipmentStatus === "CREATED";
  const vendorHasShipped = fulfilment.status === "DISPATCHED" || !["PENDING", "PREPARING", "READY"].includes(fulfilment.status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">{fulfilment.orderNumber}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {fulfilment.vendorName} · {international ? "International" : "Domestic collection"}
          </p>
        </div>
        <FulfilmentStatusBadge status={fulfilment.status} />
      </div>

      {fulfilment.openIssue ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-800">Open issue: {fulfilment.openIssue.category}</p>
          <p className="mt-1 text-sm text-red-700">{fulfilment.openIssue.description}</p>
          <div className="mt-3">
            <ResolveIssueForm fulfilmentId={fulfilment.id} issueId={fulfilment.openIssue.id} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-display text-base font-medium text-stone-900">Items</h2>
          <ul className="mt-2 divide-y divide-stone-100">
            {fulfilment.items.map((item) => (
              <li key={item.id} className="flex justify-between py-2 text-sm">
                <span className="text-stone-700">{item.description}</span>
                <span className="font-medium text-stone-900">× {item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-display text-base font-medium text-stone-900">Customer delivery destination</h2>
          <dl className="mt-2 divide-y divide-stone-100">
            <Row label="Recipient" value={fulfilment.deliveryInfo.recipientName} />
            <Row label="Phone" value={fulfilment.deliveryInfo.phone} />
            <Row label="Address" value={`${fulfilment.deliveryInfo.addressLine1}, ${fulfilment.deliveryInfo.city}, ${fulfilment.deliveryInfo.region}`} />
          </dl>
        </div>
      </div>

      {!international ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-display text-base font-medium text-stone-900">Vendor pickup details</h2>
          <dl className="mt-2 divide-y divide-stone-100">
            <Row label="Address" value={fulfilment.vendorPickup.addressLine1 ?? "Not provided"} />
            <Row label="Contact" value={fulfilment.vendorPickup.contactName ?? ""} />
            <Row label="Phone" value={fulfilment.vendorPickup.contactPhone ?? ""} />
            <Row label="Hours" value={fulfilment.vendorPickup.hours ?? ""} />
          </dl>
          {fulfilment.vendorPickup.notes ? <p className="mt-2 text-sm text-stone-600">{fulfilment.vendorPickup.notes}</p> : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-base font-medium text-stone-900">Logistics</h2>

        {international && awaitingHandoff && !vendorHasShipped ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-stone-600">
              Receiving destination: {fulfilment.shipment?.receivingLocation?.name ?? "Not yet assigned"}
            </p>
            <AssignReceivingLocationForm
              fulfilmentId={fulfilment.id}
              locations={locations.map((l) => ({ id: l.id, name: l.name }))}
            />
            <p className="text-xs text-stone-400">Waiting for the vendor to ship to this destination.</p>
          </div>
        ) : null}

        {international && awaitingHandoff && vendorHasShipped ? (
          <div className="mt-3 flex flex-col gap-3">
            <FormMessage tone="success">
              Vendor shipped via {fulfilment.shipment?.carrier} ({fulfilment.shipment?.trackingReference})
              {fulfilment.shipment?.shippedAt ? ` on ${fulfilment.shipment.shippedAt.toLocaleDateString("en-GB")}` : ""}.
            </FormMessage>
            <ConfirmCollectedButton fulfilmentId={fulfilment.id} label="Confirm received by CrownSourceGlobal" />
          </div>
        ) : null}

        {!international && awaitingHandoff && fulfilment.status === "READY" ? (
          <div className="mt-3 flex flex-col gap-4">
            <ConfirmCollectionForm fulfilmentId={fulfilment.id} />
          </div>
        ) : null}

        {!international && awaitingHandoff && fulfilment.status !== "READY" ? (
          <p className="mt-3 text-sm text-stone-500">Waiting for the vendor to mark this ready for collection.</p>
        ) : null}

        {!awaitingHandoff && shipmentStatus !== "DELIVERED" && shipmentStatus !== "DELIVERY_FAILED" ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-stone-600">Current shipment status: {shipmentStatus.replace(/_/g, " ").toLowerCase()}</p>
            <ProgressButtons fulfilmentId={fulfilment.id} shipmentStatus={shipmentStatus} />
            <ReportFailureForm fulfilmentId={fulfilment.id} />
          </div>
        ) : null}

        {shipmentStatus === "DELIVERY_FAILED" ? (
          <div className="mt-3 flex flex-col gap-2">
            <FormMessage tone="error">Delivery failed: {fulfilment.shipment?.deliveryNotes}</FormMessage>
            <ResumeAfterFailureButton fulfilmentId={fulfilment.id} />
          </div>
        ) : null}

        {shipmentStatus === "DELIVERED" ? <FormMessage tone="success">Delivered.</FormMessage> : null}
      </div>
    </div>
  );
}
