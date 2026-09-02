"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession, getCurrentCustomerProfile } from "../../modules/identity/policy";
import { requireAdminSession } from "../../modules/administration/policy";
import { sourcingService } from "../../modules/sourcing/service";
import { err, ok, type Result } from "../result";

const ADMIN_OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"] as const;

// --- Customer ---------------------------------------------------------

const specEntrySchema = z.object({ key: z.string().trim().min(1), value: z.string().trim().min(1) });

function parseSpecifications(formData: FormData): Record<string, string> | undefined {
  const keys = formData.getAll("specKey").map(String);
  const values = formData.getAll("specValue").map(String);
  const entries: Record<string, string> = {};
  for (let i = 0; i < keys.length; i += 1) {
    const parsed = specEntrySchema.safeParse({ key: keys[i], value: values[i] });
    if (parsed.success) entries[parsed.data.key] = parsed.data.value;
  }
  return Object.keys(entries).length > 0 ? entries : undefined;
}

export async function submitSourcingRequestAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const session = await requireSession("/sourcing/new");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return err("Something went wrong. Please try again.");

  const quantityRaw = Number(formData.get("quantity"));
  const requiredByRaw = String(formData.get("requiredByDate") ?? "");
  const budgetRaw = formData.get("budgetAmount");

  const files: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  for (const entry of formData.getAll("attachments")) {
    if (entry instanceof File && entry.size > 0) {
      files.push({ buffer: Buffer.from(await entry.arrayBuffer()), filename: entry.name, mimeType: entry.type });
    }
  }

  const result = await sourcingService.submitRequest(customerProfile.id, session.user.id, session.user.email, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    quantity: quantityRaw,
    quantityUnit: String(formData.get("quantityUnit") ?? "") || undefined,
    specifications: parseSpecifications(formData),
    requiredByDate: requiredByRaw ? new Date(requiredByRaw) : undefined,
    deliveryCountry: String(formData.get("deliveryCountry") ?? ""),
    deliveryRegion: String(formData.get("deliveryRegion") ?? "") || undefined,
    deliveryCity: String(formData.get("deliveryCity") ?? "") || undefined,
    budgetAmount: budgetRaw ? Number(budgetRaw) : undefined,
    budgetCurrency: String(formData.get("budgetCurrency") ?? "") || undefined,
    categoryId: String(formData.get("categoryId") ?? "") || undefined,
  }, files);

  if (!result.ok) return result;

  redirect(`/account/sourcing/${result.value.id}?submitted=true`);
}

export async function cancelSourcingRequestAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const session = await requireSession("/account/sourcing");
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile) return err("Something went wrong. Please try again.");

  const id = String(formData.get("id") ?? "");
  const result = await sourcingService.cancelRequest(id, customerProfile.id);
  if (result.ok) revalidatePath(`/account/sourcing/${id}`);
  return result;
}

// --- Admin/staff --------------------------------------------------------

export async function assignStaffAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const staffId = String(formData.get("staffId") ?? "") || null;
  const result = await sourcingService.assignStaff(id, staffId);
  if (result.ok) revalidatePath(`/admin/sourcing/${id}`);
  return result;
}

export async function moveToUnderReviewAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const result = await sourcingService.moveToUnderReview(id);
  if (result.ok) revalidatePath(`/admin/sourcing/${id}`);
  return result;
}

export async function moveToSourcingAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const result = await sourcingService.moveToSourcing(id);
  if (result.ok) revalidatePath(`/admin/sourcing/${id}`);
  return result;
}

export async function requestClarificationAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const message = String(formData.get("message") ?? "");
  const result = await sourcingService.requestClarification(id, session.user.id, message);
  if (result.ok) revalidatePath(`/admin/sourcing/${id}`);
  return result;
}

const addOptionSchema = z.object({
  sourceType: z.enum(["VENDOR_LISTING", "VENDOR", "EXTERNAL_SUPPLIER"]),
  vendorId: z.string().trim().optional(),
  vendorListingId: z.string().trim().optional(),
  externalSupplierName: z.string().trim().optional(),
  externalSupplierContact: z.string().trim().optional(),
  quantityAvailable: z.coerce.number().int().positive().optional(),
  proposedQuantity: z.coerce.number().int().positive(),
  unitSupplyCost: z.coerce.number().positive(),
  leadTimeDays: z.coerce.number().int().nonnegative().optional(),
  originCountry: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function addSourcingOptionAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");

  const parsed = addOptionSchema.safeParse({
    sourceType: formData.get("sourceType"),
    vendorId: formData.get("vendorId") || undefined,
    vendorListingId: formData.get("vendorListingId") || undefined,
    externalSupplierName: formData.get("externalSupplierName") || undefined,
    externalSupplierContact: formData.get("externalSupplierContact") || undefined,
    quantityAvailable: formData.get("quantityAvailable") || undefined,
    proposedQuantity: formData.get("proposedQuantity"),
    unitSupplyCost: formData.get("unitSupplyCost"),
    leadTimeDays: formData.get("leadTimeDays") || undefined,
    originCountry: formData.get("originCountry") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the option details and try again.");

  const result = await sourcingService.addOption(id, parsed.data);
  if (result.ok) revalidatePath(`/admin/sourcing/${id}`);
  return result;
}

export async function removeSourcingOptionAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  const result = await sourcingService.removeOption(id, optionId);
  if (result.ok) revalidatePath(`/admin/sourcing/${id}`);
  return result;
}

export async function setAllocationsAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");

  const allocations: { sourcingOptionId: string; allocatedQuantity: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("allocation_")) continue;
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity <= 0) continue;
    allocations.push({ sourcingOptionId: key.replace("allocation_", ""), allocatedQuantity: quantity });
  }

  const result = await sourcingService.setAllocations(id, allocations);
  if (result.ok) revalidatePath(`/admin/sourcing/${id}`);
  return result;
}

const prepareQuoteSchema = z.object({
  description: z.string().trim().min(3, "Enter a commercial description."),
  unitPrice: z.coerce.number().positive("Enter a unit price greater than zero."),
  otherInternalCosts: z.coerce.number().nonnegative().optional(),
});

export async function prepareQuoteAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");

  const parsed = prepareQuoteSchema.safeParse({
    description: formData.get("description"),
    unitPrice: formData.get("unitPrice"),
    otherInternalCosts: formData.get("otherInternalCosts") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the quote details and try again.");

  const result = await sourcingService.prepareAndIssueQuote(id, parsed.data);
  if (!result.ok) return result;
  revalidatePath(`/admin/sourcing/${id}`);
  return ok(null);
}

export async function sendToFactoriesAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { session } = await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const vendorIds = formData.getAll("vendorId").map(String).filter(Boolean);
  const result = await sourcingService.sendToFactories(id, vendorIds, session.user.id);
  if (result.ok) revalidatePath(`/admin/sourcing/${id}`);
  return result;
}

export async function convertSolicitationToOptionAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const solicitationId = String(formData.get("solicitationId") ?? "");
  const result = await sourcingService.useSolicitationForOption(id, solicitationId);
  if (!result.ok) return result;
  revalidatePath(`/admin/sourcing/${id}`);
  return ok(null);
}

export async function markUnableToSourceAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  await requireAdminSession("/admin/sourcing", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const result = await sourcingService.markUnableToSource(id, reason);
  if (result.ok) revalidatePath(`/admin/sourcing/${id}`);
  return result;
}
