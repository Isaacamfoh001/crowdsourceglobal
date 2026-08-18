import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { sourcingService } from "../../../../../modules/sourcing/service";
import { CaseStatusBadge } from "../../../../../components/resolutions/CaseStatusBadge";
import {
  AssignResolutionStaffForm,
  MoveToReviewButton,
  ResumeReviewButton,
  RequestCustomerClarificationForm,
  RequestVendorResponseForm,
  RejectCaseForm,
  ApproveResolutionForm,
  ResolveCaseButton,
  CloseCaseButton,
  AddInternalNoteForm,
  ProcessRefundButtons,
  ReturnTransitForm,
  ConfirmReturnReceivedButton,
  InspectReturnForm,
  CompleteReturnButton,
  CreateReplacementFulfilmentButton,
} from "../../../../../components/admin/ResolutionActions";
import { formatPrice } from "../../../../../lib/format";

type Params = { id: string };

export const metadata = { title: "Resolution case — Admin" };
export const dynamic = "force-dynamic";

const ADMIN_OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"] as const;

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + " " + date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default async function AdminResolutionDetailPage({ params }: { params: Promise<Params> }) {
  await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const { id } = await params;

  const [detail, staff] = await Promise.all([resolutionsService.getDetailForAdmin(id), sourcingService.listStaffOptions()]);
  if (!detail) notFound();

  const cancellableFulfilmentId = detail.affectedVendors.length === 1 && detail.issueType === "CUSTOMER_CANCELLATION_REQUEST" ? detail.affectedVendors[0]!.fulfilmentId : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">{detail.caseNumber}</h1>
          <p className="mt-1 text-sm text-stone-500">
            Order{" "}
            <Link href={`/admin/operations`} className="text-brand-700 hover:underline">
              {detail.orderNumber}
            </Link>{" "}
            · {detail.customerName} ({detail.customerEmail}) · {detail.issueType.replace(/_/g, " ").toLowerCase()}
          </p>
        </div>
        <CaseStatusBadge status={detail.status} label={detail.statusLabel} />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-base font-medium text-stone-900">Assignment</h2>
        <div className="mt-3">
          <AssignResolutionStaffForm id={detail.id} staff={staff} assignedStaffId={detail.assignedStaffId} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-base font-medium text-stone-900">Customer report</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-700">{detail.customerDescription}</p>
            <ul className="mt-4 divide-y divide-stone-100">
              {detail.items.map((item) => (
                <li key={item.id} className="py-2.5 text-sm text-stone-700">
                  {item.description} × {item.quantityAffected} <span className="text-stone-400">(of {item.purchasedQuantity} purchased, {formatPrice(item.unitPrice, "GHS")} each)</span>
                </li>
              ))}
            </ul>
            {detail.requestedResolution ? (
              <p className="mt-2 text-xs text-stone-500">Customer requested: {detail.requestedResolution.replace(/_/g, " ").toLowerCase()}</p>
            ) : null}
            {detail.attachments.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2">
                {detail.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`/api/resolutions/attachments/${a.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline">
                      <Paperclip className="size-3.5" />
                      {a.filename}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-base font-medium text-stone-900">Customer communication</h2>
            <p className="mt-1 text-sm text-stone-500">
              Reply from{" "}
              <Link href="/admin/messages" className="text-brand-700 hover:underline">
                Admin → Messages
              </Link>{" "}
              — this case&apos;s thread appears there as &ldquo;About case {detail.caseNumber}&rdquo;.
            </p>
            {detail.status === "UNDER_REVIEW" ? (
              <div className="mt-3">
                <RequestCustomerClarificationForm id={detail.id} />
              </div>
            ) : null}
          </div>

          {detail.affectedVendors.length > 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-base font-medium text-stone-900">Vendor coordination</h2>
              <p className="mt-1 text-sm text-stone-500">Vendors never see customer contact details or this conversation with the customer.</p>
              <div className="mt-3 flex flex-col gap-4">
                {detail.affectedVendors.map((v) => (
                  <div key={v.vendorId}>
                    <p className="text-sm font-medium text-stone-900">{v.vendorName}</p>
                    {detail.status === "UNDER_REVIEW" ? (
                      <div className="mt-2">
                        <RequestVendorResponseForm id={detail.id} vendorId={v.vendorId} vendorName={v.vendorName} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {detail.status === "UNDER_REVIEW" ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-base font-medium text-stone-900">Resolution decision</h2>
              <p className="mt-1 text-sm text-stone-500">Choose an outcome per item. This creates the refund/return/replacement records and notifies the customer.</p>
              <div className="mt-4">
                <ApproveResolutionForm id={detail.id} items={detail.items} cancellableFulfilmentId={cancellableFulfilmentId} />
              </div>
              <div className="mt-6 border-t border-stone-200 pt-4">
                <RejectCaseForm id={detail.id} />
              </div>
            </div>
          ) : null}

          {detail.refunds.length > 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-base font-medium text-stone-900">Refund</h2>
              <div className="mt-3 flex flex-col gap-4">
                {detail.refunds.map((r) => {
                  const statusTone =
                    r.status === "COMPLETED" ? "text-emerald-700" : r.status === "FAILED" ? "text-red-700" : r.status === "PROCESSING" ? "text-amber-700" : "text-stone-600";
                  return (
                    <div key={r.id} className="rounded-lg border border-stone-200 p-3.5">
                      <p className="text-sm text-stone-700">Approved amount: {formatPrice(r.amount, r.currency)}</p>
                      {r.paymentProvider ? <p className="mt-1 text-xs text-stone-500">Provider: {r.paymentProvider}</p> : null}
                      <p className={`mt-1 text-sm font-medium ${statusTone}`}>Refund status: {r.status}</p>
                      {r.providerReference ? <p className="mt-1 text-xs text-stone-500">Provider refund reference: {r.providerReference}</p> : null}
                      {r.failureReason ? <p className="mt-1 text-xs text-red-600">{r.failureReason}</p> : null}
                      {r.status === "APPROVED" || r.status === "FAILED" || r.status === "PROCESSING" ? (
                        <div className="mt-2">
                          <ProcessRefundButtons caseId={detail.id} refundId={r.id} status={r.status} paymentProvider={r.paymentProvider} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {detail.returns.length > 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-base font-medium text-stone-900">Return</h2>
              <div className="mt-3 flex flex-col gap-4">
                {detail.returns.map((r) => (
                  <div key={r.id} className="rounded-lg border border-stone-200 p-3.5">
                    <p className="text-sm text-stone-700">
                      Status: <span className="font-medium">{r.status.replace(/_/g, " ").toLowerCase()}</span>
                      {r.trackingReference ? ` · ${r.trackingReference}` : ""}
                    </p>
                    {r.status === "APPROVED" ? (
                      <div className="mt-2">
                        <ReturnTransitForm caseId={detail.id} returnId={r.id} />
                      </div>
                    ) : null}
                    {r.status === "IN_TRANSIT" ? (
                      <div className="mt-2">
                        <ConfirmReturnReceivedButton caseId={detail.id} returnId={r.id} />
                      </div>
                    ) : null}
                    {r.status === "RECEIVED" ? (
                      <div className="mt-2">
                        <InspectReturnForm caseId={detail.id} returnId={r.id} />
                      </div>
                    ) : null}
                    {r.status === "INSPECTED" ? (
                      <div className="mt-2">
                        <CompleteReturnButton caseId={detail.id} returnId={r.id} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {detail.replacements.length > 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-base font-medium text-stone-900">Replacement</h2>
              <div className="mt-3 flex flex-col gap-3">
                {detail.replacements.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 p-3.5 text-sm">
                    <span className="text-stone-700">Quantity {r.quantity}</span>
                    {r.replacementFulfilmentId ? (
                      <Link href={`/admin/operations/${r.replacementFulfilmentId}`} className="text-brand-700 hover:underline">
                        View fulfilment
                      </Link>
                    ) : (
                      <CreateReplacementFulfilmentButton caseId={detail.id} replacementId={r.id} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-gold-200 bg-gold-50/40 p-5">
            <h2 className="font-display text-base font-medium text-stone-900">Internal CrownSource notes</h2>
            <p className="mt-1 text-xs text-stone-500">Never visible to the customer or vendor.</p>
            <div className="mt-3">
              <AddInternalNoteForm id={detail.id} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-base font-medium text-stone-900">Next action</h2>
            <div className="mt-3 flex flex-col gap-2">
              {detail.status === "OPEN" ? <MoveToReviewButton id={detail.id} /> : null}
              {detail.status === "AWAITING_CUSTOMER" || detail.status === "AWAITING_VENDOR" ? <ResumeReviewButton id={detail.id} /> : null}
              {detail.status === "RESOLUTION_APPROVED" || detail.status === "RESOLUTION_IN_PROGRESS" ? <ResolveCaseButton id={detail.id} /> : null}
              {detail.status === "RESOLVED" || detail.status === "REJECTED" ? <CloseCaseButton id={detail.id} /> : null}
              {detail.status === "CLOSED" ? <p className="text-sm text-stone-500">Closed.</p> : null}
            </div>
          </div>

          {detail.customerSafeDecisionReason ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-base font-medium text-stone-900">Customer-facing decision</h2>
              <p className="mt-2 text-sm text-stone-700">{detail.customerSafeDecisionReason}</p>
              {detail.responsibility ? <p className="mt-2 text-xs text-stone-400">Internal: responsibility = {detail.responsibility.toLowerCase()}</p> : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-base font-medium text-stone-900">Activity</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {detail.activities.map((activity) => (
                <li key={activity.id} className="text-stone-600">
                  <span className="font-medium text-stone-900">{activity.type.replace(/_/g, " ")}</span>
                  <span className="ml-1.5 text-xs text-stone-400">{formatDate(activity.createdAt)}</span>
                  {activity.type === "internal_note" && activity.metadata?.["note"] ? (
                    <p className="mt-0.5 text-xs text-stone-500">{String(activity.metadata["note"])}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Link href="/admin/resolutions" className="text-sm font-medium text-brand-700 hover:underline">
        ← Back to resolutions
      </Link>
    </div>
  );
}
