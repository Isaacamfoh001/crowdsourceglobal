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
  const categoryOther = String(formData.get("categoryOther") ?? "").trim() || undefined;
  const result = await vendorListingsService.createDraft(vendorId, categoryId, categoryOther);
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
  // M32.10 — MOQ is no longer vendor-facing; the editor form doesn't submit
  // it, so this always resolves to the default of 1 (never a marketplace
  // requirement — see modules/vendor-listings/service.ts's validation).
  moq: z.coerce.number().int().min(1).default(1),
  maxOq: z.coerce.number().int().min(1).optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
});

/** M32.10 — brand-new listing creation only collects these; MOQ/maxOq/lead time stay in Edit. */
const newListingContentSchema = z.object({
  title: z.string().trim().min(3, "Enter a listing title."),
  description: z.string().trim().min(10, "Add a longer description."),
  categoryId: z.string().trim().optional(),
  categoryOther: z.string().trim().min(1).max(120).optional(),
  basePrice: z.coerce.number().positive("Enter a price greater than zero."),
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
    moq: formData.get("moq") ?? undefined,
    maxOq: formData.get("maxOq") || undefined,
    leadTimeDays: formData.get("leadTimeDays") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the listing details.");

  const tiers = parseTiers(formData);
  if (tiers === null) return err("Check the bulk pricing tiers.");

  // Existing images the vendor kept (an omitted key means "removed" — see
  // vendorListingsService.saveContent's doc comment) plus newly selected
  // files to validate/upload — mirrors the sourcing-attachment action's
  // File-from-FormData pattern (lib/actions/sourcing.ts).
  const existingImages = formData.getAll("existingImages").map(String).filter(Boolean);
  const newImageFiles: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  for (const entry of formData.getAll("newImages")) {
    if (entry instanceof File && entry.size > 0) {
      newImageFiles.push({ buffer: Buffer.from(await entry.arrayBuffer()), filename: entry.name, mimeType: entry.type });
    }
  }

  const result = await vendorListingsService.saveContent(
    vendorId,
    listingId,
    { ...parsed.data, images: existingImages },
    tiers,
    newImageFiles,
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

/**
 * M32.10 — the single "Submit for review" action for brand-new listing
 * creation: saves content (against the DRAFT already created by
 * createListingAction) and immediately submits for moderation, so the
 * creation UI never shows a separate Save step. Deliberately omits
 * moq/maxOq/leadTimeDays — saveContent defaults moq to 1 and leaves
 * maxOq/leadTimeDays null when absent from the input, which is exactly what
 * a brand-new listing should start with. Those remain editable later from
 * Products → listing → Edit.
 */
export async function submitNewListingAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/listings");
  const listingId = String(formData.get("listingId") ?? "");

  const parsed = newListingContentSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    categoryId: formData.get("categoryId") || undefined,
    categoryOther: formData.get("categoryOther") || undefined,
    basePrice: formData.get("basePrice"),
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check the listing details.");
  if (!parsed.data.categoryId && !parsed.data.categoryOther) return err("Choose a category.");

  const tiers = parseTiers(formData);
  if (tiers === null) return err("Check the bulk pricing tiers.");

  const existingImages = formData.getAll("existingImages").map(String).filter(Boolean);
  const newImageFiles: { buffer: Buffer; filename: string; mimeType: string }[] = [];
  for (const entry of formData.getAll("newImages")) {
    if (entry instanceof File && entry.size > 0) {
      newImageFiles.push({ buffer: Buffer.from(await entry.arrayBuffer()), filename: entry.name, mimeType: entry.type });
    }
  }

  const saveResult = await vendorListingsService.saveContent(
    vendorId,
    listingId,
    {
      title: parsed.data.title,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId ?? "",
      categoryOther: parsed.data.categoryOther ?? null,
      basePrice: parsed.data.basePrice,
      moq: 1,
      maxOq: null,
      leadTimeDays: null,
      images: existingImages,
    },
    tiers,
    newImageFiles,
  );
  if (!saveResult.ok) return saveResult;

  const submitResult = await vendorListingsService.submitForReview(vendorId, listingId);
  if (!submitResult.ok) return submitResult;

  revalidatePath("/vendor/portal/listings");
  redirect("/vendor/portal/listings");
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
