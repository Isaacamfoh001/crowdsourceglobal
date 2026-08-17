"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession, getCurrentCustomerProfile } from "../../modules/identity/policy";
import { requireAdminSession } from "../../modules/administration/policy";
import { resolutionsService } from "../../modules/resolutions/service";
import type { ApproveResolutionInput, ResolutionDecision, ResolutionIssueType, ResolutionResponsibility } from "../../modules/resolutions/types";
import { err, ok, type Result } from "../result";

const ADMIN_OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"] as const;

// --- Customer -----------------------------------------------------------

function parseItems(formData: FormData): { orderItemId: string; quantity: number }[] {
  const ids = formData.getAll("orderItemId").map(String);
  const quantities = formData.getAll("quantity").map((v) => Number(v));
  const items: { orderItemId: string; quantity: number }[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const quantity = quantities[i];
    if (id && quantity && quantity > 0) items.push({ orderItemId: id, quantity });
  }
  return items;
}

export async function submitResolutionCaseAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const session = await requireSession("/account/orders");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return err("Something went wrong. Please try again.");

  const files: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  for (const entry of formData.getAll("evidence")) {
    if (entry instanceof File && entry.size > 0) {
      files.push({ buffer: Buffer.from(await entry.arrayBuffer()), filename: entry.name, mimeType: entry.type });
    }
  }

  const result = await resolutionsService.submitCase(customerProfile.id, session.user.id, {
    orderId: String(formData.get("orderId") ?? ""),
    issueType: String(formData.get("issueType") ?? "") as ResolutionIssueType,
    requestedResolution: (String(formData.get("requestedResolution") ?? "") || undefined) as never,
    description: String(formData.get("description") ?? ""),
    fulfilmentId: String(formData.get("fulfilmentId") ?? "") || undefined,
    items: parseItems(formData),
  });
  if (!result.ok) return result;

  for (const file of files) {
    await resolutionsService.addAttachment(customerProfile.id, session.user.id, result.value.caseId, file);
  }

  redirect(`/account/resolutions/${result.value.caseId}?submitted=true`);
}

export async function addResolutionAttachmentAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const session = await requireSession("/account/resolutions");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return err("Something went wrong. Please try again.");

  const caseId = String(formData.get("caseId") ?? "");
  const entry = formData.get("evidence");
  if (!(entry instanceof File) || entry.size === 0) return err("Choose a file to upload.");

  const result = await resolutionsService.addAttachment(customerProfile.id, session.user.id, caseId, {
    buffer: Buffer.from(await entry.arrayBuffer()),
    filename: entry.name,
    mimeType: entry.type,
  });
  if (!result.ok) return result;
  revalidatePath(`/account/resolutions/${caseId}`);
  return ok(null);
}

// --- Admin -----------------------------------------------------------

export async function assignResolutionStaffAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { admin } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const staffId = String(formData.get("staffId") ?? "") || null;
  void admin;
  const result = await resolutionsService.assignStaff(caseId, staffId);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function moveResolutionToReviewAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const result = await resolutionsService.moveToUnderReview(session.user.id, caseId);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function requestResolutionCustomerClarificationAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const message = String(formData.get("message") ?? "");
  const result = await resolutionsService.requestCustomerClarification(session.user.id, caseId, message);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function requestResolutionVendorResponseAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const vendorId = String(formData.get("vendorId") ?? "");
  const message = String(formData.get("message") ?? "");
  const result = await resolutionsService.requestVendorResponse(session.user.id, caseId, vendorId, message);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function resumeResolutionReviewAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const result = await resolutionsService.resumeReview(session.user.id, caseId);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function rejectResolutionCaseAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const result = await resolutionsService.rejectCase(session.user.id, caseId, reason);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

function parseApprovalItems(formData: FormData): ApproveResolutionInput["items"] {
  const ids = formData.getAll("itemId").map(String);
  const decisions = formData.getAll("decision").map(String);
  const amounts = formData.getAll("refundAmount").map(String);
  const quantities = formData.getAll("replacementQuantity").map(String);
  const items: ApproveResolutionInput["items"] = [];
  for (let i = 0; i < ids.length; i += 1) {
    if (!ids[i] || !decisions[i]) continue;
    items.push({
      caseItemId: ids[i]!,
      approvedResolution: decisions[i] as ResolutionDecision,
      approvedRefundAmount: amounts[i] ? Number(amounts[i]) : undefined,
      replacementQuantity: quantities[i] ? Number(quantities[i]) : undefined,
    });
  }
  return items;
}

export async function approveResolutionCaseAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const cancelFulfilmentId = String(formData.get("cancelFulfilmentId") ?? "") || undefined;

  const result = await resolutionsService.approveResolution(session.user.id, caseId, {
    items: parseApprovalItems(formData),
    responsibility: String(formData.get("responsibility") ?? "") as ResolutionResponsibility,
    customerSafeDecisionReason: String(formData.get("customerSafeDecisionReason") ?? ""),
    cancelFulfilmentId,
  });
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function resolveResolutionCaseAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const result = await resolutionsService.resolveCase(session.user.id, caseId);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function closeResolutionCaseAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const result = await resolutionsService.closeCase(session.user.id, caseId);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function addResolutionInternalNoteAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const note = String(formData.get("note") ?? "");
  const result = await resolutionsService.addInternalNote(session.user.id, caseId, note);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function processResolutionRefundAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const refundId = String(formData.get("refundId") ?? "");
  const outcome = String(formData.get("outcome") ?? "succeed") === "fail" ? "fail" : "succeed";
  const result = await resolutionsService.processRefund(session.user.id, refundId, outcome);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function recordResolutionReturnTransitAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const returnId = String(formData.get("returnId") ?? "");
  const result = await resolutionsService.recordReturnTransit(session.user.id, returnId, {
    method: String(formData.get("method") ?? ""),
    trackingReference: String(formData.get("trackingReference") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function confirmResolutionReturnReceivedAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const returnId = String(formData.get("returnId") ?? "");
  const result = await resolutionsService.confirmReturnReceived(session.user.id, returnId);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function inspectResolutionReturnAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const returnId = String(formData.get("returnId") ?? "");
  const outcome = String(formData.get("outcome") ?? "") === "RESELLABLE" ? "RESELLABLE" : "NOT_RESELLABLE";
  const result = await resolutionsService.inspectReturn(session.user.id, returnId, outcome, String(formData.get("notes") ?? ""));
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function completeResolutionReturnAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const returnId = String(formData.get("returnId") ?? "");
  const result = await resolutionsService.completeReturn(session.user.id, returnId);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}

export async function createResolutionReplacementFulfilmentAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/resolutions", [...ADMIN_OPS_ROLES]);
  const caseId = String(formData.get("caseId") ?? "");
  const replacementId = String(formData.get("replacementId") ?? "");
  const result = await resolutionsService.createReplacementFulfilment(session.user.id, replacementId);
  if (!result.ok) return result;
  revalidatePath(`/admin/resolutions/${caseId}`);
  return ok(null);
}
