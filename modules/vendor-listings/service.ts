import { vendorListingsRepository } from "./repository";
import { vendorsRepository } from "../vendors/repository";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { ok, err, type Result } from "../../lib/result";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import { storageProvider, generateStorageKey } from "../../lib/storage";
import { validateListingImage, MAX_LISTING_IMAGES } from "./image-validation";
import type { BulkTierInput, ListingFormInput, VendorListingDetail } from "./types";
import type { NotificationType } from "../notifications/types";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

/**
 * Validates and uploads newly selected product image files through the
 * existing M13 StorageProvider (never a direct S3/local-disk call from this
 * module), returning the final images array — existing kept keys first
 * (preserving whichever one is currently primary), newly uploaded ones
 * appended after. All files are validated before any upload happens, so a
 * single invalid file in a batch never leaves an orphaned upload behind.
 */
async function resolveImages(
  existingImageKeys: string[],
  newImageFiles: { buffer: Buffer; filename: string; mimeType: string }[],
): Promise<Result<string[]>> {
  if (existingImageKeys.length + newImageFiles.length > MAX_LISTING_IMAGES) {
    return err(`You can have up to ${MAX_LISTING_IMAGES} images per listing.`);
  }

  for (const file of newImageFiles) {
    const validation = validateListingImage({ mimeType: file.mimeType, sizeBytes: file.buffer.length, buffer: file.buffer });
    if (!validation.ok) return err(validation.error);
  }

  const newKeys: string[] = [];
  try {
    for (const file of newImageFiles) {
      const key = generateStorageKey("vendor-listing-images", IMAGE_EXTENSION_BY_MIME_TYPE[file.mimeType] ?? "");
      await storageProvider.putObject({ key, buffer: file.buffer, contentType: file.mimeType });
      newKeys.push(key);
    }
  } catch (error) {
    console.error("Listing image upload failed:", error);
    return err("Something went wrong uploading your image. Please try again.");
  }

  return ok([...existingImageKeys, ...newKeys]);
}

async function notifyVendorOwner(params: {
  vendorId: string;
  listingId: string;
  type: NotificationType;
  title: string;
  body: string;
  eventKey: string;
  emailTemplateKey: string;
  emailSubject: string;
  emailData: Record<string, unknown>;
}): Promise<void> {
  const owner = await vendorsRepository.findOwnerUserIdAndEmail(params.vendorId);
  if (!owner) return;
  await notificationsService.notify({
    recipientUserId: owner.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    targetUrl: notificationLinks.vendorListing(params.listingId),
    eventKey: params.eventKey,
    email: { to: owner.email, subject: params.emailSubject, templateKey: params.emailTemplateKey, templateData: params.emailData },
  });
}

/**
 * `approvalStatus: "PENDING"` is also the schema default for a brand-new,
 * never-submitted draft — a listing is only genuinely awaiting an admin
 * decision once the vendor has explicitly submitted it (`submittedAt` set).
 * Every admin decision function must gate on this, not on approvalStatus
 * alone, or a listing could be approved/rejected before the vendor ever
 * finished filling it in.
 */
function isAwaitingReview(listing: { approvalStatus: string; submittedAt: Date | null }): boolean {
  return listing.approvalStatus === "PENDING" && listing.submittedAt !== null;
}

function validateListingContent(input: ListingFormInput): Result<null> {
  if (input.title.trim().length < 3) return err("Enter a listing title (at least 3 characters).");
  if (input.description.trim().length < 10) return err("Add a longer description (at least 10 characters).");
  if (!input.categoryId) return err("Choose a category.");
  if (!(input.basePrice > 0)) return err("Enter a price greater than zero.");
  if (!(input.moq >= 1)) return err("MOQ must be at least 1.");
  if (input.maxOq != null && input.maxOq < input.moq) return err("Max order quantity can't be less than MOQ.");
  return ok(null);
}

function validateBulkTiers(tiers: BulkTierInput[]): Result<null> {
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  for (const [i, tier] of sorted.entries()) {
    if (tier.minQuantity < 1) return err("Tier quantities must be at least 1.");
    if (!(tier.unitPrice > 0)) return err("Tier prices must be greater than zero.");
    if (tier.maxQuantity != null && tier.maxQuantity < tier.minQuantity) {
      return err("A tier's maximum quantity can't be less than its minimum.");
    }
    const next: BulkTierInput | undefined = sorted[i + 1];
    if (next && (tier.maxQuantity == null || tier.maxQuantity >= next.minQuantity)) {
      return err("Bulk pricing tiers can't overlap — set a maximum below the next tier's minimum.");
    }
  }
  return ok(null);
}

export const vendorListingsService = {
  listForVendor(vendorId: string) {
    return vendorListingsRepository.findSummariesForVendor(vendorId);
  },

  /** (M11.1) Paginated variant backing the vendor portal listings list page. */
  async listForVendorPaginated(vendorId: string, page = 1) {
    const { rows, total } = await vendorListingsRepository.findSummariesForVendorPaginated(vendorId, page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  async getDetail(vendorId: string, listingId: string): Promise<VendorListingDetail | null> {
    return vendorListingsRepository.findDetailForVendor(vendorId, listingId);
  },

  async createDraft(vendorId: string, categoryId: string): Promise<Result<{ listingId: string }>> {
    if (!categoryId) return err("Choose a category to start a listing.");
    const listing = await vendorListingsRepository.createDraft(vendorId, categoryId);
    return ok({ listingId: listing.id });
  },

  async saveContent(
    vendorId: string,
    listingId: string,
    input: ListingFormInput,
    tiers: BulkTierInput[],
    newImageFiles: { buffer: Buffer; filename: string; mimeType: string }[] = [],
  ): Promise<Result<null>> {
    const listing = await vendorListingsRepository.findDetailForVendor(vendorId, listingId);
    if (!listing) return err("Listing not found.");

    // input.images is the set of EXISTING image keys the vendor kept (a
    // vendor "removes" an image simply by omitting its key here — nothing
    // is deleted from storage, see resolveImages' doc comment and the
    // M13.1 report). newImageFiles are freshly selected files to validate
    // and upload, appended after. The result is the complete, final images
    // array — same shape saveContent already persisted before M13.1, so
    // everything below (direct/staged/pendingChanges) is unchanged.
    const imagesResult = await resolveImages(input.images, newImageFiles);
    if (!imagesResult.ok) return imagesResult;
    input = { ...input, images: imagesResult.value };

    const contentCheck = validateListingContent(input);
    if (!contentCheck.ok) return contentCheck;
    const tierCheck = validateBulkTiers(tiers);
    if (!tierCheck.ok) return tierCheck;

    // A true draft has approvalStatus PENDING with submittedAt still null
    // (the schema default); once submitted, PENDING means "awaiting a
    // decision" and further edits are locked until admin acts. A listing
    // that's already APPROVED (or has an edit-in-flight staged in
    // pendingChanges) is live/was-live — edits go through pendingChanges so
    // the public row is never disturbed mid-review.
    const target: "direct" | "staged" | "locked" =
      listing.approvalStatus === "PENDING" && listing.submittedAt !== null
        ? "locked"
        : listing.pendingChanges !== null || listing.approvalStatus === "APPROVED"
          ? "staged"
          : "direct";

    if (target === "locked") {
      return err("This listing is awaiting review and can't be edited right now.");
    }

    if (target === "staged") {
      const ok1 = await vendorListingsRepository.updateFieldsForVendor(vendorId, listingId, {
        pendingChanges: { listing: input, bulkPriceTiers: tiers },
      });
      return ok1 ? ok(null) : err("Listing not found.");
    }

    const applied = await vendorListingsRepository.updateFieldsForVendor(vendorId, listingId, {
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      basePrice: input.basePrice,
      moq: input.moq,
      maxOq: input.maxOq ?? null,
      leadTimeDays: input.leadTimeDays ?? null,
      images: input.images,
      specs: input.specs ?? undefined,
    });
    if (!applied) return err("Listing not found.");
    await vendorListingsRepository.replaceBulkTiersForVendor(vendorId, listingId, tiers.map((t) => ({
      minQuantity: t.minQuantity,
      maxQuantity: t.maxQuantity ?? null,
      unitPrice: t.unitPrice,
    })));
    return ok(null);
  },

  async submitForReview(vendorId: string, listingId: string): Promise<Result<null>> {
    const listing = await vendorListingsRepository.findDetailForVendor(vendorId, listingId);
    if (!listing) return err("Listing not found.");

    if (listing.approvalStatus === "PENDING" && listing.submittedAt !== null) {
      return err("This listing is already awaiting review.");
    }

    const candidate = listing.pendingChanges?.listing ?? {
      title: listing.title,
      description: listing.description,
      categoryId: listing.categoryId,
      basePrice: listing.basePrice,
      moq: listing.moq,
      maxOq: listing.maxOq,
      leadTimeDays: listing.leadTimeDays,
      images: listing.images,
      specs: listing.specs,
    };
    const candidateTiers = listing.pendingChanges?.bulkPriceTiers ?? listing.bulkPriceTiers;

    if (listing.approvalStatus === "APPROVED" && !listing.pendingChanges) {
      return err("No changes to submit.");
    }

    const contentCheck = validateListingContent(candidate);
    if (!contentCheck.ok) return contentCheck;
    const tierCheck = validateBulkTiers(candidateTiers);
    if (!tierCheck.ok) return tierCheck;

    await vendorListingsRepository.updateFieldsForVendor(vendorId, listingId, {
      approvalStatus: "PENDING",
      submittedAt: new Date(),
    });
    return ok(null);
  },

  async updateInventory(
    vendorId: string,
    listingId: string,
    input: { availableQuantity: number; availabilityStatus: string },
  ): Promise<Result<null>> {
    if (!(input.availableQuantity >= 0)) return err("Available quantity can't be negative.");
    const applied = await vendorListingsRepository.updateFieldsForVendor(vendorId, listingId, {
      availableQuantity: input.availableQuantity,
      availabilityStatus: input.availabilityStatus,
    });
    return applied ? ok(null) : err("Listing not found.");
  },

  async toggleActive(vendorId: string, listingId: string, active: boolean): Promise<Result<null>> {
    const listing = await vendorListingsRepository.findDetailForVendor(vendorId, listingId);
    if (!listing) return err("Listing not found.");
    if (listing.approvalStatus !== "APPROVED") {
      return err("Only approved listings can be shown or hidden.");
    }
    const applied = await vendorListingsRepository.updateFieldsForVendor(vendorId, listingId, {
      listingStatus: active ? "ACTIVE" : "INACTIVE",
    });
    return applied ? ok(null) : err("Listing not found.");
  },

  // --- Admin ---------------------------------------------------------

  listPendingForAdmin() {
    return vendorListingsRepository.findPendingForAdmin();
  },

  async listPendingForAdminPaginated(page: number) {
    const { rows, total } = await vendorListingsRepository.findPendingForAdminPaginated(page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  getForAdmin(listingId: string) {
    return vendorListingsRepository.findForAdmin(listingId);
  },

  async approve(listingId: string): Promise<Result<null>> {
    const listing = await vendorListingsRepository.findForAdmin(listingId);
    if (!listing) return err("Listing not found.");
    if (!isAwaitingReview(listing)) return err("This listing is not awaiting review.");

    if (listing.pendingChanges) {
      const { listing: fields, bulkPriceTiers } = listing.pendingChanges;
      await vendorListingsRepository.applyApprovalAndActivate(
        listingId,
        {
          title: fields.title,
          description: fields.description,
          categoryId: fields.categoryId,
          basePrice: fields.basePrice,
          moq: fields.moq,
          maxOq: fields.maxOq ?? null,
          leadTimeDays: fields.leadTimeDays ?? null,
          images: fields.images,
          specs: fields.specs ?? undefined,
        },
        bulkPriceTiers.map((t) => ({ minQuantity: t.minQuantity, maxQuantity: t.maxQuantity ?? null, unitPrice: t.unitPrice })),
      );
    } else {
      await vendorListingsRepository.applyApprovalAndActivate(listingId, null, null);
    }
    const approvedTitle = listing.pendingChanges?.listing.title ?? listing.title;
    await notifyVendorOwner({
      vendorId: listing.vendorId,
      listingId,
      type: "LISTING_APPROVED",
      title: "Listing approved",
      body: `Your listing "${approvedTitle}" is now live on CrownSourceGlobal.`,
      eventKey: `listing-approved:${listingId}:${Date.now()}`,
      emailTemplateKey: "listing-approved",
      emailSubject: "Your listing is now live",
      emailData: { listingTitle: approvedTitle },
    });
    return ok(null);
  },

  async requestChanges(listingId: string, reason: string): Promise<Result<null>> {
    const listing = await vendorListingsRepository.findForAdmin(listingId);
    if (!listing) return err("Listing not found.");
    if (!isAwaitingReview(listing)) return err("This listing is not awaiting review.");
    await vendorListingsRepository.requestChanges(listingId, reason);
    await notifyVendorOwner({
      vendorId: listing.vendorId,
      listingId,
      type: "LISTING_CHANGES_REQUESTED",
      title: "Changes requested",
      body: `CrownSourceGlobal requested changes to "${listing.title}": ${reason}`,
      eventKey: `listing-changes-requested:${listingId}:${Date.now()}`,
      emailTemplateKey: "listing-changes-requested",
      emailSubject: "Changes requested on your listing",
      emailData: { listingTitle: listing.title, reason, listingId },
    });
    return ok(null);
  },

  async reject(listingId: string, reason: string): Promise<Result<null>> {
    const listing = await vendorListingsRepository.findForAdmin(listingId);
    if (!listing) return err("Listing not found.");
    if (!isAwaitingReview(listing)) return err("This listing is not awaiting review.");

    if (listing.pendingChanges) {
      // Rejecting an edit to an already-live listing discards the proposal
      // and keeps the current public version untouched — nothing the
      // vendor owns actually changed, so no "rejected" notification here
      // (it would misleadingly suggest their live listing was affected).
      await vendorListingsRepository.discardPendingChanges(listingId);
    } else {
      await vendorListingsRepository.reject(listingId, reason);
      await notifyVendorOwner({
        vendorId: listing.vendorId,
        listingId,
        type: "LISTING_REJECTED",
        title: "Listing not approved",
        body: `Your listing "${listing.title}" was not approved: ${reason}`,
        eventKey: `listing-rejected:${listingId}:${Date.now()}`,
        emailTemplateKey: "listing-rejected",
        emailSubject: "Your listing was not approved",
        emailData: { listingTitle: listing.title, reason },
      });
    }
    return ok(null);
  },
};
