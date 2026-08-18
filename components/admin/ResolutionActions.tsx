"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignResolutionStaffAction,
  moveResolutionToReviewAction,
  requestResolutionCustomerClarificationAction,
  requestResolutionVendorResponseAction,
  resumeResolutionReviewAction,
  rejectResolutionCaseAction,
  approveResolutionCaseAction,
  resolveResolutionCaseAction,
  closeResolutionCaseAction,
  addResolutionInternalNoteAction,
  processResolutionRefundAction,
  reconcilePaystackRefundAction,
  recordResolutionReturnTransitAction,
  confirmResolutionReturnReceivedAction,
  inspectResolutionReturnAction,
  completeResolutionReturnAction,
  createResolutionReplacementFulfilmentAction,
} from "../../lib/actions/resolutions";
import { Button } from "../ui/Button";
import { FormMessage } from "../ui/FormMessage";
import type { Result } from "../../lib/result";
import type { CaseItemView } from "../../modules/resolutions/types";
import type { StaffOption } from "../../modules/sourcing/types";

function ErrorMessage({ state }: { state: Result<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <div className="mt-2">
      <FormMessage tone="error">{state.error}</FormMessage>
    </div>
  );
}

export function AssignResolutionStaffForm({ id, staff, assignedStaffId }: { id: string; staff: StaffOption[]; assignedStaffId: string | null }) {
  const [state, formAction, isPending] = useActionState(assignResolutionStaffAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="caseId" value={id} />
      <select
        name="staffId"
        defaultValue={assignedStaffId ?? ""}
        disabled={isPending}
        className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
      >
        <option value="">Unassigned</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function MoveToReviewButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(moveResolutionToReviewAction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={id} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Starting…" : "Start review"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function ResumeReviewButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(resumeResolutionReviewAction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Resuming…" : "Resume review"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function RequestCustomerClarificationForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(requestResolutionCustomerClarificationAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={id} />
      <textarea
        name="message"
        rows={2}
        required
        placeholder="What do you need from the customer?"
        disabled={isPending}
        className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Sending…" : "Request more information"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function RequestVendorResponseForm({ id, vendorId, vendorName }: { id: string; vendorId: string; vendorName: string }) {
  const [state, formAction, isPending] = useActionState(requestResolutionVendorResponseAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={id} />
      <input type="hidden" name="vendorId" value={vendorId} />
      <textarea
        name="message"
        rows={2}
        required
        placeholder={`Ask ${vendorName}…`}
        disabled={isPending}
        className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Sending…" : `Ask ${vendorName}`}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function RejectCaseForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(rejectResolutionCaseAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
      <input type="hidden" name="caseId" value={id} />
      <textarea
        name="reason"
        rows={2}
        required
        minLength={3}
        placeholder="Explain the decision — the customer will see this."
        disabled={isPending}
        className="w-full rounded-lg border border-red-300 bg-white px-3.5 py-2.5 text-sm outline-none"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isPending} className="w-fit border-red-300 text-red-700">
        {isPending ? "Saving…" : "Reject case"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

const DECISION_OPTIONS = [
  { value: "NO_ACTION", label: "No action" },
  { value: "FULL_REFUND", label: "Full refund" },
  { value: "PARTIAL_REFUND", label: "Partial refund" },
  { value: "REPLACEMENT", label: "Replacement" },
  { value: "RETURN_AND_REFUND", label: "Return + refund" },
  { value: "RETURN_AND_REPLACEMENT", label: "Return + replacement" },
  { value: "REDELIVERY", label: "Redelivery" },
];

const RESPONSIBILITY_OPTIONS = ["VENDOR", "CROWNSOURCE", "LOGISTICS", "CUSTOMER", "EXTERNAL_SUPPLIER", "SHARED_OTHER"];

export function ApproveResolutionForm({
  id,
  items,
  cancellableFulfilmentId,
}: {
  id: string;
  items: CaseItemView[];
  cancellableFulfilmentId?: string;
}) {
  const [state, formAction, isPending] = useActionState(approveResolutionCaseAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="caseId" value={id} />

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-stone-200 p-3.5">
            <input type="hidden" name="itemId" value={item.id} />
            <p className="text-sm font-medium text-stone-900">
              {item.description} <span className="font-normal text-stone-400">(affected qty {item.quantityAffected}, unit price GH₵{item.unitPrice.toFixed(2)})</span>
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select name="decision" defaultValue="NO_ACTION" disabled={isPending} className="rounded-lg border border-stone-300 px-3 py-2 text-sm">
                {DECISION_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                name="refundAmount"
                step="0.01"
                min={0}
                placeholder="Refund amount (GH₵)"
                disabled={isPending}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                name="replacementQuantity"
                min={1}
                max={item.quantityAffected}
                placeholder="Replacement qty"
                disabled={isPending}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      {cancellableFulfilmentId ? (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="cancelFulfilmentId" value={cancellableFulfilmentId} className="accent-brand-700" />
          Also cancel this fulfilment and restock affected inventory
        </label>
      ) : null}

      <div>
        <label className="text-sm font-medium text-stone-900">Responsibility (internal only)</label>
        <select name="responsibility" defaultValue="CROWNSOURCE" disabled={isPending} className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm">
          {RESPONSIBILITY_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-stone-900">Explanation for the customer</label>
        <textarea
          name="customerSafeDecisionReason"
          rows={2}
          required
          minLength={3}
          placeholder="This is shown to the customer."
          disabled={isPending}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Approving…" : "Approve resolution"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function ResolveCaseButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(resolveResolutionCaseAction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={id} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Mark resolved"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function CloseCaseButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(closeResolutionCaseAction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Closing…" : "Close case"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function AddInternalNoteForm({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(addResolutionInternalNoteAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={id} />
      <textarea
        name="note"
        rows={2}
        required
        placeholder="Internal CrownSource note — never visible to the customer or vendor."
        disabled={isPending}
        className="w-full rounded-lg border border-gold-300 bg-gold-50 px-3.5 py-2.5 text-sm outline-none"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Add internal note"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function ProcessRefundButtons({
  caseId,
  refundId,
  status,
  paymentProvider,
}: {
  caseId: string;
  refundId: string;
  status: "APPROVED" | "FAILED" | "PROCESSING";
  paymentProvider: "MOCK" | "MOOLRE" | "PAYSTACK" | null;
}) {
  const [succeedState, succeedAction, succeedPending] = useActionState(processResolutionRefundAction, null);
  const [failState, failAction, failPending] = useActionState(processResolutionRefundAction, null);
  const [checkPending, setCheckPending] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const router = useRouter();

  const isRealProvider = paymentProvider === "PAYSTACK" || paymentProvider === "MOOLRE";

  async function handleCheckStatus() {
    setCheckPending(true);
    setCheckError(null);
    const result = await reconcilePaystackRefundAction(caseId, refundId);
    setCheckPending(false);
    if (!result.ok) {
      setCheckError(result.error);
      return;
    }
    router.refresh();
  }

  if (status === "PROCESSING") {
    // A real provider accepted the refund but hasn't confirmed it yet —
    // never a "mark completed" shortcut, only an independent status check.
    return (
      <div className="flex flex-col gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleCheckStatus} disabled={checkPending}>
          {checkPending ? "Checking…" : "Check refund status"}
        </Button>
        {checkError ? <p className="text-xs text-red-600">{checkError}</p> : null}
      </div>
    );
  }

  if (isRealProvider) {
    // Real providers decide the outcome themselves — no "succeed"/"fail"
    // simulate choice, since that would be misleading for a live refund.
    return (
      <div className="flex flex-col gap-2">
        <form action={succeedAction}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="refundId" value={refundId} />
          <input type="hidden" name="outcome" value="succeed" />
          <Button type="submit" size="sm" disabled={succeedPending}>
            {succeedPending ? "Processing…" : "Process refund"}
          </Button>
        </form>
        <ErrorMessage state={succeedState} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <form action={succeedAction}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="refundId" value={refundId} />
          <input type="hidden" name="outcome" value="succeed" />
          <Button type="submit" size="sm" disabled={succeedPending || failPending}>
            {succeedPending ? "Processing…" : "Process refund (mock)"}
          </Button>
        </form>
        <form action={failAction}>
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="refundId" value={refundId} />
          <input type="hidden" name="outcome" value="fail" />
          <Button type="submit" size="sm" variant="outline" disabled={succeedPending || failPending}>
            {failPending ? "Simulating…" : "Simulate failure"}
          </Button>
        </form>
      </div>
      <ErrorMessage state={succeedState} />
      <ErrorMessage state={failState} />
    </div>
  );
}

export function ReturnTransitForm({ caseId, returnId }: { caseId: string; returnId: string }) {
  const [state, formAction, isPending] = useActionState(recordResolutionReturnTransitAction, null);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="returnId" value={returnId} />
      <input type="text" name="method" required placeholder="Method (e.g. courier pickup)" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      <input type="text" name="trackingReference" placeholder="Tracking reference" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
      <Button type="submit" variant="outline" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Mark in transit"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function ConfirmReturnReceivedButton({ caseId, returnId }: { caseId: string; returnId: string }) {
  const [state, formAction, isPending] = useActionState(confirmResolutionReturnReceivedAction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="returnId" value={returnId} />
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "Saving…" : "Confirm received"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function InspectReturnForm({ caseId, returnId }: { caseId: string; returnId: string }) {
  const [state, formAction, isPending] = useActionState(inspectResolutionReturnAction, null);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="returnId" value={returnId} />
      <select name="outcome" defaultValue="RESELLABLE" disabled={isPending} className="w-fit rounded-lg border border-stone-300 px-3 py-2 text-sm">
        <option value="RESELLABLE">Resellable — restock</option>
        <option value="NOT_RESELLABLE">Not resellable</option>
      </select>
      <textarea name="notes" rows={2} placeholder="Inspection notes (internal)" disabled={isPending} className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm" />
      <Button type="submit" variant="outline" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save inspection"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function CompleteReturnButton({ caseId, returnId }: { caseId: string; returnId: string }) {
  const [state, formAction, isPending] = useActionState(completeResolutionReturnAction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="returnId" value={returnId} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Saving…" : "Complete return"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function CreateReplacementFulfilmentButton({ caseId, replacementId }: { caseId: string; replacementId: string }) {
  const [state, formAction, isPending] = useActionState(createResolutionReplacementFulfilmentAction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="replacementId" value={replacementId} />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Creating…" : "Create replacement order"}
      </Button>
      <ErrorMessage state={state} />
    </form>
  );
}
