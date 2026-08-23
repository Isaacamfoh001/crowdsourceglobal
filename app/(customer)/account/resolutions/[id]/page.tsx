import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { CaseStatusBadge } from "../../../../../components/resolutions/CaseStatusBadge";
import { AskAboutButton } from "../../../../../components/messaging/AskAboutButton";
import { AddEvidenceForm } from "../../../../../components/resolutions/AddEvidenceForm";
import { formatPrice } from "../../../../../lib/format";

type Params = { id: string };

export const metadata = { title: "Case detail" };
export const dynamic = "force-dynamic";

export default async function ResolutionDetailPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ submitted?: string }> }) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const session = await requireSession(`/account/resolutions/${id}`);
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) notFound();

  const detail = await resolutionsService.getForCustomer(customerProfile.id, id);
  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      {submitted === "true" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-champagne-300 bg-champagne-200/20 p-5">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-forest-800" strokeWidth={1.75} />
          <div>
            <p className="font-display text-lg font-medium text-forest-950">Report received</p>
            <p className="mt-1 text-sm text-forest-900">CrownSourceGlobal will review this and follow up with you.</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-espresso-950">{detail.caseNumber}</h1>
          <p className="mt-1 text-sm text-espresso-900/50">
            Order{" "}
            <Link href={`/account/orders/${detail.orderId}`} className="text-forest-800 hover:underline">
              {detail.orderNumber}
            </Link>
          </p>
        </div>
        <CaseStatusBadge status={detail.status} label={detail.statusLabel} />
      </div>

      {detail.customerSafeDecisionReason ? (
        <div className="rounded-2xl border border-ivory-300 bg-white p-5">
          <h2 className="font-display text-base font-medium text-espresso-950">CrownSourceGlobal&apos;s response</h2>
          <p className="mt-2 text-sm text-espresso-800">{detail.customerSafeDecisionReason}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-ivory-300 bg-white p-5">
        <h2 className="font-display text-base font-medium text-espresso-950">What you reported</h2>
        <p className="mt-2 text-sm text-espresso-800">{detail.customerDescription}</p>
        <ul className="mt-4 divide-y divide-ivory-100">
          {detail.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="text-espresso-800">
                {item.description} × {item.quantityAffected}
              </span>
              {item.approvedResolution ? (
                <span className="text-xs font-medium text-espresso-900/50">{item.approvedResolution.replace(/_/g, " ").toLowerCase()}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {detail.attachments.length > 0 || detail.status === "OPEN" || detail.status === "UNDER_REVIEW" || detail.status === "AWAITING_CUSTOMER" ? (
        <div className="rounded-2xl border border-ivory-300 bg-white p-5">
          <h2 className="font-display text-base font-medium text-espresso-950">Evidence</h2>
          {detail.attachments.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {detail.attachments.map((a) => (
                <li key={a.id}>
                  <a href={`/api/resolutions/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-sm text-forest-800 hover:underline">
                    {a.filename}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3">
            <AddEvidenceForm caseId={detail.id} />
          </div>
        </div>
      ) : null}

      {detail.refunds.length > 0 ? (
        <div className="rounded-2xl border border-ivory-300 bg-white p-5">
          <h2 className="font-display text-base font-medium text-espresso-950">Refund</h2>
          {detail.refunds.map((r) => {
            const label =
              r.status === "COMPLETED"
                ? "Refund completed"
                : r.status === "PROCESSING"
                  ? "Refund approved"
                  : r.status === "FAILED"
                    ? "Refund approved"
                    : "Refund approved";
            const statusLabel =
              r.status === "COMPLETED" ? "Completed" : r.status === "PROCESSING" ? "Processing" : r.status === "FAILED" ? "Being retried" : "Awaiting processing";
            return (
              <div key={r.id} className="mt-2 border-t border-ivory-100 pt-3 first:mt-0 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-espresso-900/65">{label}</span>
                  <span className="font-semibold text-espresso-950">{formatPrice(r.amount, r.currency)}</span>
                </div>
                <p className="mt-1 text-xs text-espresso-900/50">Status: {statusLabel}</p>
                {r.status === "PROCESSING" ? (
                  <p className="mt-1 text-xs text-espresso-900/35">
                    Your bank or mobile money provider may take a little time to reflect the funds once we send it.
                  </p>
                ) : null}
                {r.status === "FAILED" ? (
                  <p className="mt-1 text-xs text-espresso-900/35">We&apos;re retrying this refund. No action is needed from you.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {detail.returns.length > 0 ? (
        <div className="rounded-2xl border border-ivory-300 bg-white p-5">
          <h2 className="font-display text-base font-medium text-espresso-950">Return</h2>
          {detail.returns.map((r) => (
            <p key={r.id} className="mt-1 text-sm text-espresso-900/65">
              Status: {r.status.replace(/_/g, " ").toLowerCase()}
              {r.trackingReference ? ` · Tracking: ${r.trackingReference}` : ""}
            </p>
          ))}
        </div>
      ) : null}

      {detail.replacements.length > 0 ? (
        <div className="rounded-2xl border border-ivory-300 bg-white p-5">
          <h2 className="font-display text-base font-medium text-espresso-950">Replacement</h2>
          {detail.replacements.map((r) => (
            <p key={r.id} className="mt-1 text-sm text-espresso-900/65">
              {r.replacementFulfilmentId ? (
                <>
                  Being prepared — track it from{" "}
                  <Link href={`/account/orders/${detail.orderId}`} className="text-forest-800 hover:underline">
                    your order
                  </Link>
                  .
                </>
              ) : (
                "Approved — CrownSourceGlobal is arranging this."
              )}
            </p>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl border border-ivory-300 bg-white p-5">
        <h2 className="font-display text-base font-medium text-espresso-950">Messages</h2>
        <div className="mt-3">
          <AskAboutButton
            contextType="RESOLUTION_CASE"
            contextRefId={detail.id}
            currentPath={`/account/resolutions/${detail.id}`}
            isSignedIn
            label="Message CrownSourceGlobal about this case"
            placeholder="Add more detail or ask a question…"
          />
        </div>
      </div>

      <Link href="/account/resolutions" className="text-sm font-medium text-forest-800 hover:underline">
        ← Back to returns & issues
      </Link>
    </div>
  );
}
