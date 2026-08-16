"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "../../modules/identity/policy";
import { vendorApplicationsService } from "../../modules/vendor-applications/service";
import { SELLER_TYPES } from "../../modules/vendor-applications/types";
import { err, type Result } from "../result";

const sellerTypeValues = SELLER_TYPES.map((t) => t.value) as [string, ...string[]];

export async function startApplicationAction() {
  const session = await requireSession("/vendor/onboarding");
  await vendorApplicationsService.getOrCreateForUser(session.user.id);
  redirect("/vendor/onboarding/seller-type");
}

const sellerTypeSchema = z.object({ sellerType: z.enum(sellerTypeValues) });

export async function saveSellerTypeAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const session = await requireSession("/vendor/onboarding");
  const parsed = sellerTypeSchema.safeParse({ sellerType: formData.get("sellerType") });
  if (!parsed.success) return err("Choose how you sell.");

  const result = await vendorApplicationsService.saveSellerType(session.user.id, {
    sellerType: parsed.data.sellerType as never,
  });
  if (!result.ok) return result;
  redirect("/vendor/onboarding/details");
}

const contactSchema = z.object({
  contactName: z.string().trim().min(2, "Enter your name."),
  contactEmail: z.email("Enter a valid email address."),
  contactPhone: z.string().trim().min(9, "Enter a valid phone number."),
});

export async function saveContactAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const session = await requireSession("/vendor/onboarding");
  const parsed = contactSchema.safeParse({
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check your contact details.");

  const result = await vendorApplicationsService.saveContact(session.user.id, parsed.data);
  if (!result.ok) return result;
  redirect("/vendor/onboarding/business");
}

const businessSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your store or business name."),
  legalName: z.string().trim().optional(),
  storeDescription: z.string().trim().min(10, "Tell customers a little about your store."),
  registrationNumber: z.string().trim().optional(),
  taxIdentifier: z.string().trim().optional(),
  yearEstablished: z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional(),
  websiteUrl: z.string().trim().optional(),
  country: z.string().trim().min(2, "Enter a country."),
  region: z.string().trim().min(2, "Enter a region."),
  city: z.string().trim().min(2, "Enter a city."),
  addressLine1: z.string().trim().min(3, "Enter an address."),
});

export async function saveBusinessAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const session = await requireSession("/vendor/onboarding");
  const raw = {
    displayName: formData.get("displayName"),
    legalName: formData.get("legalName") || undefined,
    storeDescription: formData.get("storeDescription"),
    registrationNumber: formData.get("registrationNumber") || undefined,
    taxIdentifier: formData.get("taxIdentifier") || undefined,
    yearEstablished: formData.get("yearEstablished") || undefined,
    websiteUrl: formData.get("websiteUrl") || undefined,
    country: formData.get("country"),
    region: formData.get("region"),
    city: formData.get("city"),
    addressLine1: formData.get("addressLine1"),
  };
  const parsed = businessSchema.safeParse(raw);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check your business information.");

  const result = await vendorApplicationsService.saveBusiness(session.user.id, parsed.data);
  if (!result.ok) return result;
  redirect("/vendor/onboarding/operations");
}

const operationsSchema = z.object({
  categorySlugs: z.array(z.string()).min(1, "Choose at least one category."),
  sellingMode: z.enum(["retail", "wholesale", "both"]),
  bulkCapable: z.coerce.boolean(),
  leadTimeDaysDefault: z.coerce.number().int().min(0).optional(),
  serviceAreas: z.string().trim().optional(),
});

export async function saveOperationsAction(_prevState: Result<null> | null, formData: FormData): Promise<Result<null>> {
  const session = await requireSession("/vendor/onboarding");
  const parsed = operationsSchema.safeParse({
    categorySlugs: formData.getAll("categorySlugs"),
    sellingMode: formData.get("sellingMode"),
    bulkCapable: formData.get("bulkCapable") === "on",
    leadTimeDaysDefault: formData.get("leadTimeDaysDefault") || undefined,
    serviceAreas: formData.get("serviceAreas") || undefined,
  });
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Check what you sell.");

  const result = await vendorApplicationsService.saveOperations(session.user.id, parsed.data);
  if (!result.ok) return result;
  redirect("/vendor/onboarding/review");
}

export async function submitApplicationAction(_prevState: Result<null> | null): Promise<Result<null>> {
  const session = await requireSession("/vendor/onboarding");
  const result = await vendorApplicationsService.submit(session.user.id);
  if (!result.ok) return result;
  redirect("/vendor/onboarding");
}
