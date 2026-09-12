import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { sourcingService } from "../../../../../modules/sourcing/service";
import { SourcingStatusBadge } from "../../../../../components/sourcing/SourcingStatusBadge";
import { AttachmentGallery } from "../../../../../components/sourcing/AttachmentGallery";
import { BackLink } from "../../../../../components/ui/BackLink";
import {
  AssignStaffForm,
  MoveToUnderReviewButton,
  MoveToSourcingButton,
  RequestClarificationForm,
  AskFactoriesForm,
  FactoryResponsesSection,
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

  const [request, staff, vendors] = await Promise.all([
    sourcingService.getDetailForAdmin(id),
    sourcingService.listStaffOptions(),
    sourcingService.listVendorOptions(),
  ]);
  if (!request) notFound();

  const allocationCost = request.allocations.reduce((sum, a) => sum + a.allocatedQuantity * a.unitSupplyCostSnapshot, 0);
  const alreadyAskedVendorIds = request.solicitations.map((s) => s.vendorId);
  const winningOptionIds = new Set(request.allocations.map((a) => a.sourcingOptionId));
  // Only a single-factory allocation has one clear "the" factory price to suggest a markup from — a mixed
  // multi-vendor allocation keeps the existing manual entry, unchanged.
  const pricingSuggestion =
    request.allocations.length === 1 ? await sourcingService.getQuotePricingSuggestion(request.allocations[0]!.sourcingOptionId) : null;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/admin/sourcing" label="Back to sourcing requests" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-espresso-950">{request.title}</h1>
          <p className="mt-1 text-sm text-espresso-900/50">
            {request.requestNumber} · {request.customerName} ({request.customerEmail})
          </p>
        </div>
        <SourcingStatusBadge status={request.status} label={request.statusLabel} />
      </div>

      <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
        <h2 className="font-display text-base font-medium text-espresso-950">Assignment</h2>
        <div className="mt-3">
          <AssignStaffForm id={request.id} staff={staff} assignedStaffId={request.assignedStaffId} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
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
              <div className="mt-4">
                <AttachmentGallery attachments={request.attachments} />
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
            <h2 className="font-display text-base font-medium text-espresso-950">Customer communication</h2>
            <p className="mt-1 text-sm text-espresso-900/50">
              Reply from the shared inbox at{" "}
              <Link href="/admin/messages" className="text-espresso-800 hover:underline">
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
            <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
              <h2 className="font-display text-base font-medium text-espresso-950">Ask factories</h2>
              <p className="mt-1 text-sm text-espresso-900/50">
                Send this request — as the customer submitted it — to one or more approved factories for a
                quote.
              </p>
              {request.status === "SOURCING" ? (
                <div className="mt-4">
                  <AskFactoriesForm id={request.id} vendors={vendors} alreadyAskedVendorIds={alreadyAskedVendorIds} />
                </div>
              ) : null}
              {request.solicitations.length > 0 ? (
                <div className="mt-6 border-t border-ivory-300 pt-4">
                  <FactoryResponsesSection id={request.id} solicitations={request.solicitations} winningOptionIds={winningOptionIds} />
                </div>
              ) : null}
            </div>
          ) : null}

          {request.allocations.length > 0 || request.status === "QUOTED" ? (
            <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
              <h2 className="font-display text-base font-medium text-espresso-950">
                {request.status === "QUOTED" ? "Revise commercial offer" : "Prepare commercial offer"}
              </h2>
              <p className="mt-1 text-sm text-espresso-900/50">
                {request.status === "QUOTED"
                  ? "Issuing a new quote supersedes the current one — history is preserved."
                  : "The selected supplier's cost feeds this offer — set what the customer sees and pays below."}
              </p>
              <div className="mt-4">
                <PrepareQuoteForm id={request.id} allocationCost={allocationCost} currency="GHS" pricingSuggestion={pricingSuggestion} />
              </div>
            </div>
          ) : null}

          {["UNDER_REVIEW", "SOURCING", "AWAITING_CUSTOMER"].includes(request.status) ? (
            <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
              <h2 className="font-display text-base font-medium text-espresso-950">Unable to source</h2>
              <div className="mt-3">
                <MarkUnableToSourceForm id={request.id} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
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
            <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
              <h2 className="font-display text-base font-medium text-espresso-950">Quotation history</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {request.quotations.map((quotation) => (
                  <li key={quotation.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/admin/quotations/${quotation.id}`} className="font-medium text-espresso-800 hover:underline">
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

          <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
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

    </div>
  );
}
