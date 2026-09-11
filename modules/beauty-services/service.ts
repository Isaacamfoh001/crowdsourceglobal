import { beautyServicesRepository } from "./repository";
import { beautyProfessionalsRepository } from "../beauty-professionals/repository";
import { catalogueRepository } from "../catalogue/repository";
import { ok, err, type Result } from "../../lib/result";
import { EXPLORE_CATEGORY_SLUGS, OTHER_CATEGORY_SLUG } from "../../prisma/reference-data";
import type { BeautyServiceInput, VendorServiceView } from "./types";

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/**
 * M32.5 — "Other / Not listed" (a free-text `categoryOther`, no real
 * `categoryId` from the client) resolves to the shared placeholder
 * Category's real id, same pattern as vendor-listings/service.ts's own
 * resolveCategory. `categoryId` on the row stays a required, always-valid
 * FK — `categoryOther` is purely descriptive and never itself a Category.
 */
async function resolveCategory(
  categoryId: string | undefined,
  categoryOther: string | undefined,
): Promise<Result<{ categoryId: string; categoryOther: string | null }>> {
  const other = categoryOther?.trim();
  if (other) {
    if (other.length > 120) return err("Category name is too long.");
    const placeholder = await catalogueRepository.findCategoryBySlug(OTHER_CATEGORY_SLUG);
    if (!placeholder) return err("Choose a valid service category.");
    return ok({ categoryId: placeholder.id, categoryOther: other });
  }
  if (!categoryId) return err("Choose a service category.");
  const category = await catalogueRepository.findCategoryById(categoryId);
  if (!category || !EXPLORE_CATEGORY_SLUGS.includes(category.slug)) return err("Choose a valid service category.");
  return ok({ categoryId, categoryOther: null });
}

async function validateInput(
  input: BeautyServiceInput,
): Promise<Result<{ startingPrice: string | null; categoryId: string; categoryOther: string | null }>> {
  if (input.name.trim().length < 2) return err("Enter a service name.");
  if (input.name.trim().length > 120) return err("Service name is too long.");
  if (input.description && input.description.length > 1000) return err("Description must be under 1000 characters.");

  const category = await resolveCategory(input.categoryId, input.categoryOther);
  if (!category.ok) return category;

  if (!input.startingPrice) return ok({ startingPrice: null, ...category.value });
  if (!MONEY_PATTERN.test(input.startingPrice)) return err("Enter a valid starting price.");
  return ok({ startingPrice: input.startingPrice, ...category.value });
}

/**
 * Ownership is always resolved through the caller's own approved
 * BeautyProfessionalProfile (vendorId -> professionalId) — never a
 * client-supplied professionalId, same IDOR-prevention shape as
 * modules/vendor-listings' vendorId-scoped update/delete.
 */
async function requireProfessionalId(vendorId: string): Promise<string | null> {
  const profile = await beautyProfessionalsRepository.findForVendor(vendorId);
  return profile ? profile.id : null;
}

export const beautyServicesService = {
  async listForVendor(vendorId: string): Promise<VendorServiceView[]> {
    const professionalId = await requireProfessionalId(vendorId);
    if (!professionalId) return [];
    return beautyServicesRepository.listForProfile(professionalId);
  },

  async create(vendorId: string, input: BeautyServiceInput): Promise<Result<VendorServiceView>> {
    const professionalId = await requireProfessionalId(vendorId);
    if (!professionalId) return err("Create your Beauty Professional profile first.");

    const validation = await validateInput(input);
    if (!validation.ok) return validation;

    const created = await beautyServicesRepository.create(professionalId, {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      categoryId: validation.value.categoryId,
      categoryOther: validation.value.categoryOther,
      startingPrice: validation.value.startingPrice,
      currency: input.currency ?? "GHS",
    });
    return ok(created);
  },

  async update(vendorId: string, serviceId: string, input: BeautyServiceInput): Promise<Result<null>> {
    const professionalId = await requireProfessionalId(vendorId);
    if (!professionalId) return err("Beauty Professional profile not found.");

    const validation = await validateInput(input);
    if (!validation.ok) return validation;

    const updated = await beautyServicesRepository.updateForProfile(professionalId, serviceId, {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      categoryId: validation.value.categoryId,
      categoryOther: validation.value.categoryOther,
      startingPrice: validation.value.startingPrice,
      currency: input.currency ?? "GHS",
    });
    return updated ? ok(null) : err("Service not found.");
  },

  async toggleActive(vendorId: string, serviceId: string, active: boolean): Promise<Result<null>> {
    const professionalId = await requireProfessionalId(vendorId);
    if (!professionalId) return err("Beauty Professional profile not found.");
    const updated = await beautyServicesRepository.toggleActiveForProfile(professionalId, serviceId, active);
    return updated ? ok(null) : err("Service not found.");
  },
};
