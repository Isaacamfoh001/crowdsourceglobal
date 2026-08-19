"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVendorPortalContext } from "../../modules/vendors/policy";
import { requireAdminSession } from "../../modules/administration/policy";
import { requireSession } from "../../modules/identity/policy";
import { identityService } from "../../modules/identity/service";
import { fulfilmentService } from "../../modules/fulfilment/service";
import { err, ok, type Result } from "../result";

// --- Vendor ----------------------------------------------------------------

export async function startPreparingAction(formData: FormData): Promise<void> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/orders");
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  await fulfilmentService.startPreparing(vendorId, fulfilmentId);
  revalidatePath(`/vendor/portal/orders/${fulfilmentId}`);
  revalidatePath("/vendor/portal/orders");
}

export async function markReadyAction(formData: FormData): Promise<void> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/orders");
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  await fulfilmentService.markReady(vendorId, fulfilmentId);
  revalidatePath(`/vendor/portal/orders/${fulfilmentId}`);
  revalidatePath("/vendor/portal/orders");
}

const issueSchema = z.object({
  category: z.enum(["cannot_fulfil_quantity", "item_unavailable", "preparation_delay", "damaged_stock", "other"]),
  description: z.string().trim().min(5, "Describe the issue in a bit more detail."),
});

export async function reportFulfilmentIssueAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId, session } = await requireVendorPortalContext("/vendor/portal/orders");
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const parsed = issueSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the issue details.");

  const result = await fulfilmentService.reportIssue(
    vendorId,
    fulfilmentId,
    session.user.id,
    parsed.data.category,
    parsed.data.description,
  );
  if (!result.ok) return result;
  revalidatePath(`/vendor/portal/orders/${fulfilmentId}`);
  revalidatePath("/vendor/portal/orders");
  return ok(null);
}

const vendorShipmentSchema = z.object({
  carrier: z.string().trim().min(2, "Enter a carrier name."),
  trackingReference: z.string().trim().min(2, "Enter a tracking reference."),
  shippedAt: z.string().min(1, "Enter the ship date."),
  expectedArrivalAt: z.string().optional(),
});

export async function recordVendorShipmentAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/orders");
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const parsed = vendorShipmentSchema.safeParse({
    carrier: formData.get("carrier"),
    trackingReference: formData.get("trackingReference"),
    shippedAt: formData.get("shippedAt"),
    expectedArrivalAt: formData.get("expectedArrivalAt") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the shipment details.");

  const result = await fulfilmentService.recordVendorShipment(vendorId, fulfilmentId, {
    carrier: parsed.data.carrier,
    trackingReference: parsed.data.trackingReference,
    shippedAt: new Date(parsed.data.shippedAt),
    expectedArrivalAt: parsed.data.expectedArrivalAt ? new Date(parsed.data.expectedArrivalAt) : null,
  });
  if (!result.ok) return result;
  revalidatePath(`/vendor/portal/orders/${fulfilmentId}`);
  return ok(null);
}

// --- Admin operations --------------------------------------------------

const ADMIN_OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"] as const;

export async function assignReceivingLocationAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/operations", [...ADMIN_OPS_ROLES]);
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const receivingLocationId = String(formData.get("receivingLocationId") ?? "");
  if (!receivingLocationId) return err("Choose a receiving location.");
  const result = await fulfilmentService.assignReceivingLocation(fulfilmentId, receivingLocationId);
  if (!result.ok) return result;
  revalidatePath(`/admin/operations/${fulfilmentId}`);
  return ok(null);
}

const collectionSchema = z.object({
  carrier: z.string().trim().optional(),
  trackingReference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/** (M11.1) Replaces the old two-step "Save collection details" + separate "Confirm collected" — one action, atomic. */
export async function confirmCollectionAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/operations", [...ADMIN_OPS_ROLES]);
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const parsed = collectionSchema.safeParse({
    carrier: formData.get("carrier") || undefined,
    trackingReference: formData.get("trackingReference") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return err("Check the collection details.");

  const result = await fulfilmentService.confirmCollection(fulfilmentId, session.user.id, {
    carrier: parsed.data.carrier,
    trackingReference: parsed.data.trackingReference,
    notes: parsed.data.notes,
  });
  if (!result.ok) return result;
  revalidatePath(`/admin/operations/${fulfilmentId}`);
  revalidatePath("/admin/operations");
  return ok(null);
}

export async function confirmCollectedAction(formData: FormData): Promise<void> {
  const { session } = await requireAdminSession("/admin/operations", [...ADMIN_OPS_ROLES]);
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const receivingLocationId = String(formData.get("receivingLocationId") ?? "") || null;
  await fulfilmentService.confirmCollectedOrReceived(fulfilmentId, session.user.id, receivingLocationId);
  revalidatePath(`/admin/operations/${fulfilmentId}`);
  revalidatePath("/admin/operations");
}

export async function progressToInTransitAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  await requireAdminSession("/admin/operations", [...ADMIN_OPS_ROLES]);
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const result = await fulfilmentService.progressToInTransit(fulfilmentId);
  if (!result.ok) return result;
  revalidatePath(`/admin/operations/${fulfilmentId}`);
  return ok(null);
}

export async function progressToOutForDeliveryAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  await requireAdminSession("/admin/operations", [...ADMIN_OPS_ROLES]);
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const result = await fulfilmentService.progressToOutForDelivery(fulfilmentId);
  if (!result.ok) return result;
  revalidatePath(`/admin/operations/${fulfilmentId}`);
  return ok(null);
}

export async function confirmDeliveredAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  await requireAdminSession("/admin/operations", [...ADMIN_OPS_ROLES]);
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const result = await fulfilmentService.confirmDelivered(fulfilmentId);
  if (!result.ok) return result;
  revalidatePath(`/admin/operations/${fulfilmentId}`);
  return ok(null);
}

export async function reportDeliveryFailedAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/operations", [...ADMIN_OPS_ROLES]);
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (notes.trim().length < 3) return err("Add a note about the failed delivery.");
  const result = await fulfilmentService.reportDeliveryFailed(fulfilmentId, notes);
  if (!result.ok) return result;
  revalidatePath(`/admin/operations/${fulfilmentId}`);
  return ok(null);
}

export async function resumeAfterFailureAction(formData: FormData): Promise<void> {
  await requireAdminSession("/admin/operations", [...ADMIN_OPS_ROLES]);
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  await fulfilmentService.resumeAfterFailure(fulfilmentId);
  revalidatePath(`/admin/operations/${fulfilmentId}`);
}

export async function resolveIssueAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/operations", [...ADMIN_OPS_ROLES]);
  const issueId = String(formData.get("issueId") ?? "");
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  const resolutionNotes = String(formData.get("resolutionNotes") ?? "");
  const result = await fulfilmentService.resolveIssue(issueId, session.user.id, resolutionNotes);
  if (!result.ok) return result;
  revalidatePath(`/admin/operations/${fulfilmentId}`);
  return ok(null);
}

// --- Customer ------------------------------------------------------------

export async function confirmCustomerReceiptAction(formData: FormData): Promise<void> {
  const session = await requireSession("/account/orders");
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  if (!customerProfile) return;

  const orderId = String(formData.get("orderId") ?? "");
  const fulfilmentId = String(formData.get("fulfilmentId") ?? "");
  await fulfilmentService.confirmCustomerReceipt(fulfilmentId, orderId, customerProfile.id);
  revalidatePath(`/account/orders/${orderId}`);
}
