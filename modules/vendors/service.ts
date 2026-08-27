import { vendorsRepository } from "./repository";
import { catalogueService, CATALOGUE_PAGE_SIZE } from "../catalogue/service";
import { ok, err, type Result } from "../../lib/result";
import type { StoreProfileInput } from "./types";

export const vendorsService = {
  async getStorefront(slug: string, page = 1, pageSize = CATALOGUE_PAGE_SIZE) {
    const vendor = await vendorsRepository.findPublicVendorBySlug(slug);
    if (!vendor) {
      return null;
    }

    const { rows, total } = await catalogueService.listListings({ vendorId: vendor.id }, page, pageSize);
    return { vendor, listings: rows, total, pageSize };
  },

  getFirstMembershipForUser(userId: string) {
    return vendorsRepository.findFirstMembershipForUser(userId);
  },

  /** (M18.1) Every Vendor a user has a membership in — see repository. */
  listMembershipsForUser(userId: string) {
    return vendorsRepository.findAllMembershipsForUser(userId);
  },

  isMember(userId: string, vendorId: string) {
    return vendorsRepository.isMember(userId, vendorId);
  },

  getStoreProfile(vendorId: string) {
    return vendorsRepository.findStoreProfile(vendorId);
  },

  async updateStoreProfile(vendorId: string, input: StoreProfileInput): Promise<Result<null>> {
    if (input.companyName.trim().length < 2) {
      return err("Enter a store name.");
    }
    await vendorsRepository.updateStoreProfile(vendorId, {
      companyName: input.companyName,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      country: input.country ?? null,
      region: input.region ?? null,
      city: input.city ?? null,
      categorySlugs: input.categorySlugs,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      leadTimeDaysDefault: input.leadTimeDaysDefault ?? null,
      pickupAddressLine1: input.pickupAddressLine1 ?? null,
      pickupContactName: input.pickupContactName ?? null,
      pickupContactPhone: input.pickupContactPhone ?? null,
      pickupHours: input.pickupHours ?? null,
      pickupNotes: input.pickupNotes ?? null,
    });
    return ok(null);
  },
};
