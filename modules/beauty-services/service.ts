import { beautyServicesRepository } from "./repository";
import { beautyProfessionalsRepository } from "../beauty-professionals/repository";
import { catalogueRepository } from "../catalogue/repository";
import { ok, err, type Result } from "../../lib/result";
import { EXPLORE_CATEGORY_SLUGS } from "../../prisma/reference-data";
import type { BeautyServiceInput, VendorServiceView } from "./types";

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

async function validateInput(input: BeautyServiceInput): Promise<Result<{ startingPrice: string | null }>> {
  if (input.name.trim().length < 2) return err("Enter a service name.");
  if (input.name.trim().length > 120) return err("Service name is too long.");
  if (input.description && input.description.length > 1000) return err("Description must be under 1000 characters.");

  const category = await catalogueRepository.findCategoryById(input.categoryId);
  if (!category || !EXPLORE_CATEGORY_SLUGS.includes(category.slug)) return err("Choose a valid service category.");

  if (!input.startingPrice) return ok({ startingPrice: null });
  if (!MONEY_PATTERN.test(input.startingPrice)) return err("Enter a valid starting price.");
  return ok({ startingPrice: input.startingPrice });
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
      categoryId: input.categoryId,
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
      categoryId: input.categoryId,
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
