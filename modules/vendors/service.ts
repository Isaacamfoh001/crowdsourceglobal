import { vendorsRepository } from "./repository";
import { catalogueService, CATALOGUE_PAGE_SIZE } from "../catalogue/service";
import { ok, err, type Result } from "../../lib/result";
import { storageProvider, generateStorageKey } from "../../lib/storage";
import { validateVendorLogoImage } from "./image-validation";
import type { StoreProfileInput } from "./types";

const LOGO_IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

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

  /**
   * Real store-logo upload (M29.1) — replaces the old "paste a URL" UX,
   * same StorageProvider pattern as beautyProfessionalsService's
   * resolveHeroImage. Old keys/URLs are never deleted — same "opaque keys
   * are cheap to leave orphaned" convention already established for
   * listing/Explore-post/Beauty-Professional images.
   */
  async updateLogo(vendorId: string, file: { buffer: Buffer; mimeType: string }): Promise<Result<null>> {
    const validation = validateVendorLogoImage({ mimeType: file.mimeType, sizeBytes: file.buffer.length, buffer: file.buffer });
    if (!validation.ok) return err(validation.error);

    try {
      const key = generateStorageKey("vendor-logo-images", LOGO_IMAGE_EXTENSION_BY_MIME_TYPE[file.mimeType] ?? "");
      await storageProvider.putObject({ key, buffer: file.buffer, contentType: file.mimeType });
      await vendorsRepository.updateStoreProfile(vendorId, { logoUrl: key });
      return ok(null);
    } catch (error) {
      console.error("Vendor logo upload failed:", error);
      return err("Something went wrong uploading your logo. Please try again.");
    }
  },

  async removeLogo(vendorId: string): Promise<Result<null>> {
    await vendorsRepository.updateStoreProfile(vendorId, { logoUrl: null });
    return ok(null);
  },
};
