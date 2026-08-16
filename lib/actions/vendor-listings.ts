"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVendorPortalContext } from "../../modules/vendors/policy";
import { vendorListingsService } from "../../modules/vendor-listings/service";
import { err, ok, type Result } from "../result";

export async function createListingAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/listings");
  const categoryId = String(formData.get("categoryId") ?? "");
  const result = await vendorListingsService.createDraft(vendorId, categoryId);
  if (!result.ok) return result;
  redirect(`/vendor/portal/listings/${result.value.listingId}`);
}

const tierSchema = z.object({
  minQuantity: z.coerce.number().int().min(1),
  maxQuantity: z.coerce.number().int().min(1).optional(),
  unitPrice: z.coerce.number().positive(),
});

const contentSchema = z.object({
  title: z.string().trim().min(3, "Enter a listing title."),
  description: z.string().trim().min(10, "Add a longer description."),
  categoryId: z.string().trim().min(1, "Choose a category."),
  basePrice: z.coerce.number().positive("Enter a price greater than zero."),
  moq: z.coerce.number().int().min(1),
  maxOq: z.coerce.number().int().min(1).optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  images: z.string().trim().optional(),
});

function parseTiers(formData: FormData) {
  const mins = formData.getAll("tierMinQuantity");
  const maxs = formData.getAll("tierMaxQuantity");
  const prices = formData.getAll("tierUnitPrice");
  const tiers = [];
  for (let i = 0; i < mins.length; i++) {
    if (!mins[i] || !prices[i]) continue;
    const parsed = tierSchema.safeParse({
      minQuantity: mins[i],
      maxQuantity: maxs[i] || undefined,
      unitPrice: prices[i],
    });
    if (!parsed.success) return null;
    tiers.push(parsed.data);
  }
  return tiers;
}

export async function saveListingAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/listings");
  const listingId = String(formData.get("listingId") ?? "");

  const parsed = contentSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId"),
    basePrice: formData.get("basePrice"),
    moq: formData.get("moq"),
    maxOq: formData.get("maxOq") || undefined,
    leadTimeDays: formData.get("leadTimeDays") || undefined,
    images: formData.get("images") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the listing details.");

  const tiers = parseTiers(formData);
  if (tiers === null) return err("Check the bulk pricing tiers.");

  const images = parsed.data.images
    ? parsed.data.images.split("\n").map((line) => line.trim()).filter(Boolean)
    : [];

  const result = await vendorListingsService.saveContent(
    vendorId,
    listingId,
    { ...parsed.data, images },
    tiers,
  );
  if (!result.ok) return result;
  revalidatePath(`/vendor/portal/listings/${listingId}`);
  return ok(null);
}

export async function submitListingAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/listings");
  const listingId = String(formData.get("listingId") ?? "");
  const result = await vendorListingsService.submitForReview(vendorId, listingId);
  if (!result.ok) return result;
  revalidatePath(`/vendor/portal/listings/${listingId}`);
  revalidatePath("/vendor/portal/listings");
  return ok(null);
}

const inventorySchema = z.object({
  availableQuantity: z.coerce.number().int().min(0, "Available quantity can't be negative."),
  availabilityStatus: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "MADE_TO_ORDER"]),
});

export async function updateInventoryAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/listings");
  const listingId = String(formData.get("listingId") ?? "");
  const parsed = inventorySchema.safeParse({
    availableQuantity: formData.get("availableQuantity"),
    availabilityStatus: formData.get("availabilityStatus"),
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the inventory values.");

  const result = await vendorListingsService.updateInventory(vendorId, listingId, parsed.data);
  if (!result.ok) return result;
  revalidatePath(`/vendor/portal/listings/${listingId}`);
  return ok(null);
}

export async function toggleActiveAction(formData: FormData): Promise<void> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/listings");
  const listingId = String(formData.get("listingId") ?? "");
  const active = formData.get("active") === "true";
  await vendorListingsService.toggleActive(vendorId, listingId, active);
  revalidatePath("/vendor/portal/listings");
  revalidatePath(`/vendor/portal/listings/${listingId}`);
}
