import { vendorsRepository } from "./repository";
import { catalogueService } from "../catalogue/service";
import { ok, err, type Result } from "../../lib/result";
import type { StoreProfileInput } from "./types";

export const vendorsService = {
  async getStorefront(slug: string) {
    const vendor = await vendorsRepository.findPublicVendorBySlug(slug);
    if (!vendor) {
      return null;
    }

    const listings = await catalogueService.listListings({ vendorId: vendor.id });
    return { vendor, listings };
  },

  getFirstMembershipForUser(userId: string) {
    return vendorsRepository.findFirstMembershipForUser(userId);
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
    });
    return ok(null);
  },
};
