"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../modules/administration/policy";
import { vendorApplicationsService } from "../../modules/vendor-applications/service";
import { vendorListingsService } from "../../modules/vendor-listings/service";
import { messagingService } from "../../modules/messaging/service";
import { err, ok, type Result } from "../result";

// --- Vendor application moderation -----------------------------------

export async function beginApplicationReviewAction(formData: FormData): Promise<void> {
  await requireAdminSession("/admin/vendor-applications");
  const applicationId = String(formData.get("applicationId") ?? "");
  await vendorApplicationsService.beginReview(applicationId);
  revalidatePath(`/admin/vendor-applications/${applicationId}`);
}

export async function approveApplicationAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/vendor-applications", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const applicationId = String(formData.get("applicationId") ?? "");
  const result = await vendorApplicationsService.approve(session.user.id, applicationId);
  if (!result.ok) return result;
  revalidatePath(`/admin/vendor-applications/${applicationId}`);
  revalidatePath("/admin/vendor-applications");
  return ok(null);
}

export async function requestApplicationChangesAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/vendor-applications", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const applicationId = String(formData.get("applicationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return err("Explain what needs to change.");
  const result = await vendorApplicationsService.requestChanges(session.user.id, applicationId, reason);
  if (!result.ok) return result;
  revalidatePath(`/admin/vendor-applications/${applicationId}`);
  revalidatePath("/admin/vendor-applications");
  return ok(null);
}

export async function rejectApplicationAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/vendor-applications", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const applicationId = String(formData.get("applicationId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return err("Explain the reason for rejection.");
  const result = await vendorApplicationsService.reject(session.user.id, applicationId, reason);
  if (!result.ok) return result;
  revalidatePath(`/admin/vendor-applications/${applicationId}`);
  revalidatePath("/admin/vendor-applications");
  return ok(null);
}

// --- Listing moderation ------------------------------------------------

export async function approveListingAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/listings", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const listingId = String(formData.get("listingId") ?? "");
  const result = await vendorListingsService.approve(listingId);
  if (!result.ok) return result;
  revalidatePath(`/admin/listings/${listingId}`);
  revalidatePath("/admin/listings");
  return ok(null);
}

export async function requestListingChangesAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/listings", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const listingId = String(formData.get("listingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return err("Explain what needs to change.");
  const result = await vendorListingsService.requestChanges(listingId, reason);
  if (!result.ok) return result;
  revalidatePath(`/admin/listings/${listingId}`);
  revalidatePath("/admin/listings");
  return ok(null);
}

export async function rejectListingAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/listings", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const listingId = String(formData.get("listingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3) return err("Explain the reason.");
  const result = await vendorListingsService.reject(listingId, reason);
  if (!result.ok) return result;
  revalidatePath(`/admin/listings/${listingId}`);
  revalidatePath("/admin/listings");
  return ok(null);
}

// --- Managed messaging ---------------------------------------------------

export async function adminReplyAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/messages", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "");
  const result = await messagingService.replyAsStaff(session.user.id, conversationId, body);
  if (!result.ok) return result;
  revalidatePath(`/admin/messages/${conversationId}`);
  return ok(null);
}
