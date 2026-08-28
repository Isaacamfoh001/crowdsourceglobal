import { beautyProfessionalsRepository } from "./repository";
import { vendorsRepository } from "../vendors/repository";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { ok, err, type Result } from "../../lib/result";
import { storageProvider, generateStorageKey } from "../../lib/storage";
import { validateBeautyProfessionalImage } from "./image-validation";
import { EXPLORE_CATEGORY_SLUGS } from "../../prisma/reference-data";
import type { NotificationType } from "../notifications/types";
import type { ImageFileInput, ProfileInput, PublicBeautyProfessionalDetail } from "./types";

const FEED_PAGE_SIZE = 12;
const PAGE_SIZE = 20;

const IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function validateInput(input: ProfileInput): Result<null> {
  if (input.displayName.trim().length < 2) return err("Enter a professional/business display name.");
  if (input.displayName.trim().length > 120) return err("Display name is too long.");
  if (input.bio && input.bio.length > 1000) return err("Bio must be under 1000 characters.");
  const invalidSlug = input.specialtyCategorySlugs.find((slug) => !EXPLORE_CATEGORY_SLUGS.includes(slug));
  if (invalidSlug) return err("Choose valid specialties.");
  if (input.specialtyCategorySlugs.length === 0) return err("Choose at least one specialty.");
  return ok(null);
}

/**
 * Uploads a newly-selected hero photo through the existing M13
 * StorageProvider — same shape as explore-posts' resolveImages, bounded to
 * exactly one image (M22.1 §4: a real Choose/Take Photo upload, never a
 * pasted URL). Old keys are never deleted — same "opaque keys are cheap to
 * leave orphaned" convention already established for listing/Explore-post
 * images (modules/explore-posts/service.ts's doc comment).
 */
async function resolveHeroImage(file: ImageFileInput): Promise<Result<string>> {
  const validation = validateBeautyProfessionalImage({ mimeType: file.mimeType, sizeBytes: file.buffer.length, buffer: file.buffer });
  if (!validation.ok) return err(validation.error);

  try {
    const key = generateStorageKey("beauty-professional-images", IMAGE_EXTENSION_BY_MIME_TYPE[file.mimeType] ?? "");
    await storageProvider.putObject({ key, buffer: file.buffer, contentType: file.mimeType });
    return ok(key);
  } catch (error) {
    console.error("Beauty Professional hero image upload failed:", error);
    return err("Something went wrong uploading your photo. Please try again.");
  }
}

async function notifyVendorOwner(params: {
  vendorId: string;
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
    targetUrl: notificationLinks.vendorBeautyProfessionalProfile(),
    eventKey: params.eventKey,
    email: { to: owner.email, subject: params.emailSubject, templateKey: params.emailTemplateKey, templateData: params.emailData },
  });
}

export const beautyProfessionalsService = {
  // --- Public discovery ------------------------------------------------

  async getFeed(params: { categorySlug?: string; search?: string; cursor?: string }) {
    const page = await beautyProfessionalsRepository.listPublicFeed(params, FEED_PAGE_SIZE);
    return { rows: await beautyProfessionalsRepository.toPublicSummaries(page.rows), nextCursor: page.nextCursor };
  },

  async getPublicDetail(id: string): Promise<PublicBeautyProfessionalDetail | null> {
    const found = await beautyProfessionalsRepository.findPublicById(id);
    if (!found) return null;
    const summary = await beautyProfessionalsRepository.toPublicSummary(found.row);
    return {
      ...summary,
      locationMode: found.row.locationMode,
      services: found.row.services.map((svc) => ({
        id: svc.id,
        name: svc.name,
        description: svc.description,
        startingPrice: svc.startingPrice ? { amount: Number(svc.startingPrice).toFixed(2), currency: svc.currency } : null,
        category: svc.category,
      })),
      portfolio: found.portfolio,
    };
  },

  // --- Vendor (own profile) --------------------------------------------

  getForVendor(vendorId: string) {
    return beautyProfessionalsRepository.findForVendor(vendorId);
  },

  /**
   * Create (first submission) or edit an existing profile. First-time
   * submission and any edit while DRAFT/CHANGES_REQUESTED/REJECTED goes
   * back into PENDING for admin review (the one moderated decision — see
   * schema doc comment). An edit to an already-APPROVED profile applies
   * immediately with no new review (self-serve, same convention as Vendor's
   * own store-profile settings). Editing an ARCHIVED profile republishes it
   * directly — it was already vetted once.
   */
  async submitOrUpdate(vendorId: string, input: ProfileInput): Promise<Result<{ status: string }>> {
    const validation = validateInput(input);
    if (!validation.ok) return validation;

    let heroImageResult: string | null | undefined; // undefined = leave untouched
    if (input.heroImageFile) {
      const uploaded = await resolveHeroImage(input.heroImageFile);
      if (!uploaded.ok) return uploaded;
      heroImageResult = uploaded.value;
    } else if (input.removeHeroImage) {
      heroImageResult = null;
    }

    const textFields = {
      displayName: input.displayName.trim(),
      bio: input.bio?.trim() || null,
      specialtyCategorySlugs: input.specialtyCategorySlugs,
      locationMode: input.locationMode,
    };

    const existing = await beautyProfessionalsRepository.findForVendor(vendorId);

    if (!existing) {
      const created = await beautyProfessionalsRepository.createAndSubmit(vendorId, { ...textFields, heroImage: heroImageResult ?? null });
      return ok({ status: created.status });
    }

    if (existing.status === "PENDING") {
      return err("Your profile is already awaiting review.");
    }

    // Only include heroImage in the update payload when the caller actually
    // changed it — omitting the key leaves the existing photo untouched
    // (a vendor editing their bio shouldn't have to re-upload every time).
    const heroImagePatch = heroImageResult !== undefined ? { heroImage: heroImageResult } : {};

    if (existing.status === "APPROVED") {
      const updated = await beautyProfessionalsRepository.updateForVendor(vendorId, { ...textFields, ...heroImagePatch });
      return ok({ status: updated.status });
    }

    if (existing.status === "ARCHIVED") {
      const updated = await beautyProfessionalsRepository.updateForVendor(vendorId, { ...textFields, ...heroImagePatch, status: "APPROVED" });
      return ok({ status: updated.status });
    }

    // DRAFT / CHANGES_REQUESTED / REJECTED — (re)submit for review.
    const updated = await beautyProfessionalsRepository.updateForVendor(vendorId, {
      ...textFields,
      ...heroImagePatch,
      status: "PENDING",
      submittedAt: new Date(),
      changesRequestedReason: null,
    });
    return ok({ status: updated.status });
  },

  async archive(vendorId: string): Promise<Result<null>> {
    const archived = await beautyProfessionalsRepository.archiveForVendor(vendorId);
    return archived ? ok(null) : err("Only a live profile can be taken down.");
  },

  // --- Admin -------------------------------------------------------------

  async listPendingForAdminPaginated(page: number) {
    const { rows, total } = await beautyProfessionalsRepository.findPendingForAdminPaginated(page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  getForAdmin(id: string) {
    return beautyProfessionalsRepository.findForAdmin(id);
  },

  async approve(id: string): Promise<Result<null>> {
    const profile = await beautyProfessionalsRepository.findForAdmin(id);
    if (!profile) return err("Profile not found.");
    if (profile.status !== "PENDING") return err("This profile is not awaiting review.");
    await beautyProfessionalsRepository.approve(id);
    await notifyVendorOwner({
      vendorId: profile.vendorId,
      type: "BEAUTY_PROFESSIONAL_APPROVED",
      title: "You're live on Beauty Services",
      body: "Your Beauty Professional profile is now visible to CrownSourceGlobal customers.",
      eventKey: `beauty-professional-approved:${id}:${Date.now()}`,
      emailTemplateKey: "beauty-professional-approved",
      emailSubject: "Your Beauty Professional profile is now live",
      emailData: {},
    });
    return ok(null);
  },

  async requestChanges(id: string, reason: string): Promise<Result<null>> {
    const profile = await beautyProfessionalsRepository.findForAdmin(id);
    if (!profile) return err("Profile not found.");
    if (profile.status !== "PENDING") return err("This profile is not awaiting review.");
    await beautyProfessionalsRepository.requestChanges(id, reason);
    await notifyVendorOwner({
      vendorId: profile.vendorId,
      type: "BEAUTY_PROFESSIONAL_CHANGES_REQUESTED",
      title: "Changes requested on your Beauty Professional profile",
      body: `CrownSourceGlobal requested changes: ${reason}`,
      eventKey: `beauty-professional-changes-requested:${id}:${Date.now()}`,
      emailTemplateKey: "beauty-professional-changes-requested",
      emailSubject: "Changes requested on your Beauty Professional profile",
      emailData: { reason },
    });
    return ok(null);
  },

  async reject(id: string, reason: string): Promise<Result<null>> {
    const profile = await beautyProfessionalsRepository.findForAdmin(id);
    if (!profile) return err("Profile not found.");
    if (profile.status !== "PENDING") return err("This profile is not awaiting review.");
    await beautyProfessionalsRepository.reject(id, reason);
    await notifyVendorOwner({
      vendorId: profile.vendorId,
      type: "BEAUTY_PROFESSIONAL_REJECTED",
      title: "Your Beauty Professional profile was not approved",
      body: `Your profile was not approved: ${reason}`,
      eventKey: `beauty-professional-rejected:${id}:${Date.now()}`,
      emailTemplateKey: "beauty-professional-rejected",
      emailSubject: "Your Beauty Professional profile was not approved",
      emailData: { reason },
    });
    return ok(null);
  },
};
