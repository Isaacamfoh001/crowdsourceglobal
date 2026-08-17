import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Paperclip } from "lucide-react";
import { Button } from "../../../../../components/ui/Button";
import { SourcingStatusBadge } from "../../../../../components/sourcing/SourcingStatusBadge";
import { CancelSourcingRequestButton } from "../../../../../components/sourcing/CancelSourcingRequestButton";
import { AskAboutButton } from "../../../../../components/messaging/AskAboutButton";
import { formatPrice } from "../../../../../lib/format";
import { requireSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { sourcingService } from "../../../../../modules/sourcing/service";
import { getPendingMessageIntent } from "../../../../../lib/actions/messaging";

type Params = { id: string };

const CANCELLABLE = new Set(["SUBMITTED", "UNDER_REVIEW", "SOURCING", "AWAITING_CUSTOMER"]);

export const metadata = { title: "Sourcing request" };
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function SourcingRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const session = await requireSession(`/account/sourcing/${id}`);
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) notFound();

  // Ownership enforced inside getDetailForCustomer — scoped by (id, customerProfileId) together.
  const request = await sourcingService.getDetailForCustomer(id, customerProfile.id);
  if (!request) notFound();

  const resumedMessage = await getPendingMessageIntent("SOURCING_REQUEST", id);

  return (
    <div className="flex flex-col gap-6">
      {submitted === "true" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand-700" strokeWidth={1.75} />
          <div>
            <p className="font-display text-lg font-medium text-brand-900">We&apos;ve received your sourcing request</p>
            <p className="mt-1 text-sm text-brand-800">
              {request.requestNumber} — our sourcing team will review your requirements and contact you through
              CrownSourceGlobal if we need more information.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-stone-900">{request.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {request.requestNumber} · Submitted {formatDate(request.submittedAt)}
          </p>
        </div>
        <SourcingStatusBadge status={request.status} label={request.statusLabel} />
      </div>

      {request.status === "UNABLE_TO_SOURCE" && request.unableToSourceReason ? (
        <div className="rounded-2xl border border-stone-300 bg-stone-100 p-5 text-sm text-stone-700">
          {request.unableToSourceReason}
        </div>
      ) : null}

      {request.latestQuotation ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <div>
            <p className="font-display text-base font-medium text-brand-900">Your quotation is ready</p>
            <p className="mt-1 text-sm text-brand-800">
              {request.latestQuotation.reference} · {formatPrice(request.latestQuotation.total, request.latestQuotation.currency)}
            </p>
          </div>
          <Link href={`/account/quotes/${request.latestQuotation.id}`}>
            <Button size="sm">View Quotation</Button>
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-base font-medium text-stone-900">Requirement</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-700">{request.description}</p>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-stone-500">Quantity</p>
                <p className="mt-0.5 font-medium text-stone-900">
                  {request.quantity} {request.quantityUnit ?? ""}
                </p>
              </div>
              {request.requiredByDate ? (
                <div>
                  <p className="text-stone-500">Required by</p>
                  <p className="mt-0.5 font-medium text-stone-900">{formatDate(request.requiredByDate)}</p>
                </div>
              ) : null}
              {request.budgetAmount ? (
                <div>
                  <p className="text-stone-500">Budget</p>
                  <p className="mt-0.5 font-medium text-stone-900">
                    {formatPrice(request.budgetAmount, request.budgetCurrency ?? "GHS")}
                  </p>
                </div>
              ) : null}
            </div>

            {request.specifications && Object.keys(request.specifications).length > 0 ? (
              <dl className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-200">
                {Object.entries(request.specifications).map(([key, value]) => (
                  <div key={key} className="flex justify-between px-4 py-2.5 text-sm">
                    <dt className="text-stone-500">{key}</dt>
                    <dd className="font-medium text-stone-900">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          {request.attachments.length > 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-base font-medium text-stone-900">Attachments</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {request.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <a
                      href={`/api/sourcing/attachments/${attachment.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-medium text-brand-700 hover:underline"
                    >
                      <Paperclip className="size-3.5" />
                      {attachment.filename}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <AskAboutButton
              contextType="SOURCING_REQUEST"
              contextRefId={request.id}
              currentPath={`/account/sourcing/${request.id}`}
              isSignedIn
              resumedBody={resumedMessage}
              label="Message CrownSourceGlobal about this request"
              placeholder="Ask a question or add more detail…"
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-base font-medium text-stone-900">Delivery</h2>
            <p className="mt-2 text-sm text-stone-600">
              {[request.deliveryCity, request.deliveryRegion, request.deliveryCountry].filter(Boolean).join(", ")}
            </p>
          </div>

          {CANCELLABLE.has(request.status) ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-sm text-stone-500">No longer need this?</p>
              <div className="mt-3">
                <CancelSourcingRequestButton id={request.id} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Link href="/account/sourcing" className="text-sm font-medium text-brand-700 hover:underline">
        ← Back to sourcing requests
      </Link>
    </div>
  );
}
