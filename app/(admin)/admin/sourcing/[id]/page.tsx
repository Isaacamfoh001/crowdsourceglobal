import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { sourcingService } from "../../../../../modules/sourcing/service";
import { SourcingStatusBadge } from "../../../../../components/sourcing/SourcingStatusBadge";
import {
  AssignStaffForm,
  MoveToUnderReviewButton,
  MoveToSourcingButton,
  RequestClarificationForm,
  AddSourcingOptionForm,
  RemoveSourcingOptionButton,
  AllocationForm,
  PrepareQuoteForm,
  MarkUnableToSourceForm,
} from "../../../../../components/admin/SourcingActions";
import { formatPrice } from "../../../../../lib/format";

type Params = { id: string };

export const metadata = { title: "Sourcing request — Admin" };
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminSourcingDetailPage({ params }: { params: Promise<Params> }) {
  await requireAdminSession("/admin/sourcing");
  const { id } = await params;

  const [request, staff, vendors, listings] = await Promise.all([
    sourcingService.getDetailForAdmin(id),
    sourcingService.listStaffOptions(),
    sourcingService.listVendorOptions(),
    sourcingService.listVendorListingOptions(),
  ]);
  if (!request) notFound();

  const allocationCost = request.allocations.reduce((sum, a) => sum + a.allocatedQuantity * a.unitSupplyCostSnapshot, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-espresso-950">{request.title}</h1>
          <p className="mt-1 text-sm text-espresso-900/50">
            {request.requestNumber} · {request.customerName} ({request.customerEmail})
          </p>
        </div>
        <SourcingStatusBadge status={request.status} label={request.statusLabel} />
      </div>

      <div className="rounded-2xl border border-ivory-300 bg-white p-5">
        <h2 className="font-display text-base font-medium text-espresso-950">Assignment</h2>
        <div className="mt-3">
          <AssignStaffForm id={request.id} staff={staff} assignedStaffId={request.assignedStaffId} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-ivory-300 bg-white p-5">
            <h2 className="font-display text-base font-medium text-espresso-950">Customer requirement</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-espresso-800">{request.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-espresso-900/50">Quantity</p>
                <p className="mt-0.5 font-medium text-espresso-950">
                  {request.quantity} {request.quantityUnit ?? ""}
                </p>
              </div>
              <div>
                <p className="text-espresso-900/50">Destination</p>
                <p className="mt-0.5 font-medium text-espresso-950">
                  {[request.deliveryCity, request.deliveryRegion, request.deliveryCountry].filter(Boolean).join(", ")}
                </p>
              </div>
              {request.requiredByDate ? (
                <div>
                  <p className="text-espresso-900/50">Required by</p>
                  <p className="mt-0.5 font-medium text-espresso-950">{formatDate(request.requiredByDate)}</p>
                </div>
              ) : null}
              {request.budgetAmount ? (
                <div>
                  <p className="text-espresso-900/50">Customer budget</p>
                  <p className="mt-0.5 font-medium text-espresso-950">
                    {formatPrice(request.budgetAmount, request.budgetCurrency ?? "GHS")}
                  </p>
                </div>
              ) : null}
            </div>
            {request.specifications && Object.keys(request.specifications).length > 0 ? (
              <dl className="mt-4 divide-y divide-ivory-100 rounded-xl border border-ivory-300">
                {Object.entries(request.specifications).map(([key, value]) => (
                  <div key={key} className="flex justify-between px-4 py-2.5 text-sm">
                    <dt className="text-espresso-900/50">{key}</dt>
                    <dd className="font-medium text-espresso-950">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {request.attachments.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {request.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      href={`/api/sourcing/attachments/${attachment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-forest-800 hover:underline"
                    >
                      <Paperclip className="size-3.5" />
                      {attachment.filename}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-2xl border border-ivory-300 bg-white p-5">
            <h2 className="font-display text-base font-medium text-espresso-950">Customer communication</h2>
            <p className="mt-1 text-sm text-espresso-900/50">
              Reply from the shared inbox at{" "}
              <Link href="/admin/messages" className="text-forest-800 hover:underline">
                Admin → Messages
              </Link>{" "}
              — this request&apos;s thread appears there under &ldquo;About sourcing request {request.requestNumber}&rdquo;.
            </p>
            {request.status === "SOURCING" ? (
              <div className="mt-3">
                <RequestClarificationForm id={request.id} />
              </div>
            ) : null}
          </div>

          {(request.status === "SOURCING" || request.status === "QUOTED") ? (
            <div className="rounded-2xl border border-ivory-300 bg-white p-5">
              <h2 className="font-display text-base font-medium text-espresso-950">Internal sourcing options</h2>
              <p className="mt-1 text-sm text-espresso-900/50">
                Never visible to the customer — marketplace vendors, listings, or external suppliers under
                consideration.
              </p>

              {request.options.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3">
                  {request.options.map((option) => (
                    <div key={option.id} className="flex items-center justify-between gap-3 rounded-xl border border-ivory-300 p-3 text-sm">
                      <div>
                        <p className="font-medium text-espresso-950">
                          {option.vendorName ?? option.vendorListingTitle ?? option.externalSupplierName}
                          <span className="ml-2 text-xs font-normal text-espresso-900/35">{option.sourceType}</span>
                        </p>
                        <p className="text-xs text-espresso-900/50">
                          {formatPrice(option.unitSupplyCost, option.currency)}/unit · proposed {option.proposedQuantity}
                          {option.leadTimeDays ? ` · ${option.leadTimeDays}d lead time` : ""}
                          {option.originCountry ? ` · ${option.originCountry}` : ""}
                          {option.notes ? ` · "${option.notes}"` : ""}
                        </p>
                      </div>
                      <RemoveSourcingOptionButton id={request.id} optionId={option.id} />
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4">
                <AddSourcingOptionForm id={request.id} vendors={vendors} listings={listings} />
              </div>

              {request.options.length > 0 ? (
                <div className="mt-6 border-t border-ivory-300 pt-4">
                  <h3 className="text-sm font-medium text-espresso-950">Allocate supply</h3>
                  <div className="mt-3">
                    <AllocationForm id={request.id} options={request.options} quantity={request.quantity} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {(request.status === "SOURCING" || request.status === "QUOTED") ? (
            <div className="rounded-2xl border border-ivory-300 bg-white p-5">
              <h2 className="font-display text-base font-medium text-espresso-950">
                {request.status === "QUOTED" ? "Revise commercial offer" : "Prepare commercial offer"}
              </h2>
              <p className="mt-1 text-sm text-espresso-900/50">
                {request.status === "QUOTED"
                  ? "Issuing a new quote supersedes the current one — history is preserved."
                  : "Allocated quantity must equal the requested quantity before issuing."}
              </p>
              <div className="mt-4">
                <PrepareQuoteForm id={request.id} allocationCost={allocationCost} currency="GHS" />
              </div>
            </div>
          ) : null}

          {["UNDER_REVIEW", "SOURCING", "AWAITING_CUSTOMER"].includes(request.status) ? (
            <div className="rounded-2xl border border-ivory-300 bg-white p-5">
              <h2 className="font-display text-base font-medium text-espresso-950">Unable to source</h2>
              <div className="mt-3">
                <MarkUnableToSourceForm id={request.id} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-ivory-300 bg-white p-5">
            <h2 className="font-display text-base font-medium text-espresso-950">Next action</h2>
            <div className="mt-3">
              {request.status === "SUBMITTED" ? <MoveToUnderReviewButton id={request.id} /> : null}
              {request.status === "UNDER_REVIEW" ? <MoveToSourcingButton id={request.id} label="Move to sourcing" /> : null}
              {request.status === "AWAITING_CUSTOMER" ? (
                <MoveToSourcingButton id={request.id} label="Resume sourcing" />
              ) : null}
              {["QUOTED", "ACCEPTED", "UNABLE_TO_SOURCE", "CANCELLED"].includes(request.status) ? (
                <p className="text-sm text-espresso-900/50">No pending action.</p>
              ) : null}
            </div>
          </div>

          {request.quotations.length > 0 ? (
            <div className="rounded-2xl border border-ivory-300 bg-white p-5">
              <h2 className="font-display text-base font-medium text-espresso-950">Quotation history</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {request.quotations.map((quotation) => (
                  <li key={quotation.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/admin/quotations/${quotation.id}`} className="font-medium text-forest-800 hover:underline">
                      {quotation.reference}
                    </Link>
                    <span className="text-xs text-espresso-900/50">
                      {quotation.status} · {formatPrice(quotation.total, quotation.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-ivory-300 bg-white p-5">
            <h2 className="font-display text-base font-medium text-espresso-950">Activity</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {request.activities.map((activity) => (
                <li key={activity.id} className="text-espresso-900/65">
                  <span className="font-medium text-espresso-950">{activity.type.replace(/_/g, " ")}</span>
                  <span className="ml-1.5 text-xs text-espresso-900/35">{formatDate(activity.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Link href="/admin/sourcing" className="text-sm font-medium text-forest-800 hover:underline">
        ← Back to sourcing requests
      </Link>
    </div>
  );
}
