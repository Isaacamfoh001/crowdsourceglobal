import { explorePostsRepository } from "./repository";
import { catalogueRepository } from "../catalogue/repository";
import { vendorsRepository } from "../vendors/repository";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { ok, err, type Result } from "../../lib/result";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import { storageProvider, generateStorageKey } from "../../lib/storage";
import { validateExplorePostImage, MIN_EXPLORE_POST_IMAGES, MAX_EXPLORE_POST_IMAGES } from "./image-validation";
import { EXPLORE_CATEGORY_SLUGS } from "../../prisma/reference-data";
import type { NotificationType } from "../notifications/types";

type CaptionAndCategoryInput = { caption: string; categoryId: string };

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
export const EXPLORE_FEED_PAGE_SIZE = 10;

const IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

/**
 * Validates and uploads newly selected post photos through the existing M13
 * StorageProvider — same shape as vendor-listings' resolveImages, adapted
 * for Explore's own bounds (1–6, never 0 — a post without at least one
 * photo isn't a portfolio post).
 */
async function resolveImages(newImageFiles: { buffer: Buffer; filename: string; mimeType: string }[]): Promise<Result<string[]>> {
  if (newImageFiles.length < MIN_EXPLORE_POST_IMAGES) {
    return err("Add at least one photo of the finished work.");
  }
  if (newImageFiles.length > MAX_EXPLORE_POST_IMAGES) {
    return err(`You can add up to ${MAX_EXPLORE_POST_IMAGES} photos per post.`);
  }

  for (const file of newImageFiles) {
    const validation = validateExplorePostImage({ mimeType: file.mimeType, sizeBytes: file.buffer.length, buffer: file.buffer });
    if (!validation.ok) return err(validation.error);
  }

  const keys: string[] = [];
  try {
    for (const file of newImageFiles) {
      const key = generateStorageKey("explore-post-images", IMAGE_EXTENSION_BY_MIME_TYPE[file.mimeType] ?? "");
      await storageProvider.putObject({ key, buffer: file.buffer, contentType: file.mimeType });
      keys.push(key);
    }
  } catch (error) {
    console.error("Explore post image upload failed:", error);
    return err("Something went wrong uploading your photos. Please try again.");
  }

  return ok(keys);
}

async function validateCaptionAndCategory(caption: string, categoryId: string): Promise<Result<null>> {
  if (caption.trim().length < 3) return err("Add a short caption describing the work.");
  if (caption.trim().length > 500) return err("Captions must be under 500 characters.");

  const category = await catalogueRepository.findCategoryById(categoryId);
  if (!category || !EXPLORE_CATEGORY_SLUGS.includes(category.slug)) {
    return err("Choose a valid Explore category.");
  }
  return ok(null);
}

/**
 * `approvalStatus: "PENDING"` is also the schema default — this must gate
 * on `submittedAt` too, same reasoning as vendor-listings' identical guard.
 */
function isAwaitingReview(post: { approvalStatus: string; submittedAt: Date | null }): boolean {
  return post.approvalStatus === "PENDING" && post.submittedAt !== null;
}

async function notifyVendorOwner(params: {
  vendorId: string;
  postId: string;
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
    targetUrl: notificationLinks.vendorExplorePost(params.postId),
    eventKey: params.eventKey,
    email: { to: owner.email, subject: params.emailSubject, templateKey: params.emailTemplateKey, templateData: params.emailData },
  });
}

export const explorePostsService = {
  listCategories() {
    return explorePostsRepository.listExploreCategories();
  },

  // --- Public feed / engagement ------------------------------------------

  async getFeed(params: { categoryId?: string; cursor?: string; viewerUserId?: string }) {
    const page = await explorePostsRepository.listPublicFeed(
      { categoryId: params.categoryId, cursor: params.cursor },
      EXPLORE_FEED_PAGE_SIZE,
    );
    if (!params.viewerUserId || page.rows.length === 0) {
      return { ...page, likedIds: new Set<string>(), savedIds: new Set<string>() };
    }
    const engagement = await explorePostsRepository.findEngagedPostIds(
      params.viewerUserId,
      page.rows.map((row) => row.id),
    );
    return { ...page, ...engagement };
  },

  async getSaved(userId: string, cursor?: string) {
    const page = await explorePostsRepository.listSavedForUser(userId, { cursor }, EXPLORE_FEED_PAGE_SIZE);
    const engagement = await explorePostsRepository.findEngagedPostIds(userId, page.rows.map((row) => row.id));
    return { ...page, ...engagement };
  },

  async like(id: string, userId: string): Promise<Result<null>> {
    const post = await explorePostsRepository.findPublicById(id);
    if (!post) return err("Post not found.");
    await explorePostsRepository.like(id, userId);
    return ok(null);
  },

  async unlike(id: string, userId: string): Promise<void> {
    await explorePostsRepository.unlike(id, userId);
  },

  async save(id: string, userId: string): Promise<Result<null>> {
    const post = await explorePostsRepository.findPublicById(id);
    if (!post) return err("Post not found.");
    await explorePostsRepository.save(id, userId);
    return ok(null);
  },

  async unsave(id: string, userId: string): Promise<void> {
    await explorePostsRepository.unsave(id, userId);
  },

  // --- Vendor (own posts) --------------------------------------------

  async listForVendor(vendorId: string, page = 1) {
    const { rows, total } = await explorePostsRepository.findSummariesForVendorPaginated(vendorId, page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  getForVendor(vendorId: string, id: string) {
    return explorePostsRepository.findForVendor(vendorId, id);
  },

  /**
   * Mobile's one-shot creation flow (§17): create AND submit atomically —
   * unlike VendorListing's multi-step draft/save/submit, there is no
   * persisted "save without submitting" UI in M21, so this is the single
   * entry point. `visibility` starts DRAFT (the schema default) and only
   * ever flips to PUBLISHED on admin approval.
   */
  async createAndSubmit(
    vendorId: string,
    input: CaptionAndCategoryInput,
    imageFiles: { buffer: Buffer; filename: string; mimeType: string }[],
  ): Promise<Result<{ postId: string }>> {
    const captionCheck = await validateCaptionAndCategory(input.caption, input.categoryId);
    if (!captionCheck.ok) return captionCheck;

    const imagesResult = await resolveImages(imageFiles);
    if (!imagesResult.ok) return imagesResult;

    const post = await explorePostsRepository.createAndSubmit(vendorId, {
      caption: input.caption.trim(),
      categoryId: input.categoryId,
      images: imagesResult.value,
    });
    return ok({ postId: post.id });
  },

  /**
   * Edit own post. A CHANGES_REQUESTED/REJECTED post is edited-and-
   * resubmitted directly (it was never public). An already-PUBLISHED post's
   * edit is staged in `pendingChanges` instead — its live FIELD DATA stays
   * unchanged AND (M21.1) it STAYS visible/public on the feed throughout
   * re-review, since the public feed query gates only on `visibility:
   * PUBLISHED` (never touched here), not on `approvalStatus` — see
   * prisma/schema.prisma's ExplorePost doc comment and
   * modules/explore-posts/repository.ts's listPublicFeed doc comment.
   */
  async updateAndResubmit(
    vendorId: string,
    id: string,
    input: CaptionAndCategoryInput,
    newImageFiles: { buffer: Buffer; filename: string; mimeType: string }[] = [],
    keptImages: string[] = [],
  ): Promise<Result<null>> {
    const post = await explorePostsRepository.findForVendor(vendorId, id);
    if (!post) return err("Post not found.");

    // Locked only while a never-yet-approved post is awaiting its FIRST
    // decision (PENDING and not yet PUBLISHED). Once PUBLISHED, a later
    // PENDING (a re-review from a previous edit) is fine to edit again —
    // it just overwrites the still-pending staged edit. CHANGES_REQUESTED/
    // REJECTED are always directly editable (never public yet).
    if (post.approvalStatus === "PENDING" && post.visibility !== "PUBLISHED") {
      return err("This post is awaiting review and can't be edited right now.");
    }

    const uploadResult = newImageFiles.length > 0 || keptImages.length > 0
      ? await (async (): Promise<Result<string[]>> => {
          if (keptImages.length + newImageFiles.length > MAX_EXPLORE_POST_IMAGES) {
            return err(`You can have up to ${MAX_EXPLORE_POST_IMAGES} photos per post.`);
          }
          for (const file of newImageFiles) {
            const validation = validateExplorePostImage({ mimeType: file.mimeType, sizeBytes: file.buffer.length, buffer: file.buffer });
            if (!validation.ok) return err(validation.error);
          }
          const newKeys: string[] = [];
          try {
            for (const file of newImageFiles) {
              const key = generateStorageKey("explore-post-images", IMAGE_EXTENSION_BY_MIME_TYPE[file.mimeType] ?? "");
              await storageProvider.putObject({ key, buffer: file.buffer, contentType: file.mimeType });
              newKeys.push(key);
            }
          } catch (error) {
            console.error("Explore post image upload failed:", error);
            return err("Something went wrong uploading your photos. Please try again.");
          }
          return ok([...keptImages, ...newKeys]);
        })()
      : ok(post.images);
    if (!uploadResult.ok) return uploadResult;
    if (uploadResult.value.length < MIN_EXPLORE_POST_IMAGES) {
      return err("Add at least one photo of the finished work.");
    }

    const captionCheck = await validateCaptionAndCategory(input.caption, input.categoryId);
    if (!captionCheck.ok) return captionCheck;

    const fields = { caption: input.caption.trim(), categoryId: input.categoryId, images: uploadResult.value };

    if (post.visibility === "PUBLISHED") {
      await explorePostsRepository.updateFieldsForVendor(vendorId, id, {
        pendingChanges: fields,
        approvalStatus: "PENDING",
        submittedAt: new Date(),
      });
      return ok(null);
    }

    await explorePostsRepository.updateFieldsForVendor(vendorId, id, {
      ...fields,
      approvalStatus: "PENDING",
      submittedAt: new Date(),
      changesRequestedReason: null,
    });
    return ok(null);
  },

  async archive(vendorId: string, id: string): Promise<Result<null>> {
    const archived = await explorePostsRepository.archiveForVendor(vendorId, id);
    return archived ? ok(null) : err("Only a published post can be archived.");
  },

  // --- Admin ---------------------------------------------------------

  async listPendingForAdminPaginated(page: number) {
    const { rows, total } = await explorePostsRepository.findPendingForAdminPaginated(page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  getForAdmin(id: string) {
    return explorePostsRepository.findForAdmin(id);
  },

  async approve(id: string): Promise<Result<null>> {
    const post = await explorePostsRepository.findForAdmin(id);
    if (!post) return err("Post not found.");
    if (!isAwaitingReview(post)) return err("This post is not awaiting review.");

    if (post.pendingChanges) {
      await explorePostsRepository.applyApprovalAndPublish(id, {
        caption: post.pendingChanges.caption,
        categoryId: post.pendingChanges.categoryId,
        images: post.pendingChanges.images,
      });
    } else {
      await explorePostsRepository.applyApprovalAndPublish(id, null);
    }
    await notifyVendorOwner({
      vendorId: post.vendorId,
      postId: id,
      type: "EXPLORE_POST_APPROVED",
      title: "Your Explore post is live",
      body: "Your beauty work post is now visible to CrownSourceGlobal customers.",
      eventKey: `explore-post-approved:${id}:${Date.now()}`,
      emailTemplateKey: "explore-post-approved",
      emailSubject: "Your Explore post is now live",
      emailData: {},
    });
    return ok(null);
  },

  async requestChanges(id: string, reason: string): Promise<Result<null>> {
    const post = await explorePostsRepository.findForAdmin(id);
    if (!post) return err("Post not found.");
    if (!isAwaitingReview(post)) return err("This post is not awaiting review.");
    await explorePostsRepository.requestChanges(id, reason);
    await notifyVendorOwner({
      vendorId: post.vendorId,
      postId: id,
      type: "EXPLORE_POST_CHANGES_REQUESTED",
      title: "Changes requested on your Explore post",
      body: `CrownSourceGlobal requested changes to your post: ${reason}`,
      eventKey: `explore-post-changes-requested:${id}:${Date.now()}`,
      emailTemplateKey: "explore-post-changes-requested",
      emailSubject: "Changes requested on your Explore post",
      emailData: { reason },
    });
    return ok(null);
  },

  async reject(id: string, reason: string): Promise<Result<null>> {
    const post = await explorePostsRepository.findForAdmin(id);
    if (!post) return err("Post not found.");
    if (!isAwaitingReview(post)) return err("This post is not awaiting review.");

    if (post.pendingChanges) {
      // Rejecting an edit to an already-live post discards the proposal and
      // keeps the current public version untouched — same reasoning as
      // vendor-listings: nothing the vendor owns actually changed, so no
      // "rejected" notification (it would misleadingly suggest the live
      // post was affected).
      await explorePostsRepository.discardPendingChanges(id);
    } else {
      await explorePostsRepository.reject(id, reason);
      await notifyVendorOwner({
        vendorId: post.vendorId,
        postId: id,
        type: "EXPLORE_POST_REJECTED",
        title: "Your Explore post was not approved",
        body: `Your post was not approved: ${reason}`,
        eventKey: `explore-post-rejected:${id}:${Date.now()}`,
        emailTemplateKey: "explore-post-rejected",
        emailSubject: "Your Explore post was not approved",
        emailData: { reason },
      });
    }
    return ok(null);
  },
};
