import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { explorePostsService } from "./service";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Integration tests against the real local Postgres dev database — same convention as modules/vendor-listings/service.test.ts. */
describe("explorePostsService", () => {
  let vendorAId: string;
  let vendorBId: string;
  let categoryId: string;
  let userAId: string;
  let userBId: string;
  const createdVendorIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdPostIds: string[] = [];
  const createdUserIds: string[] = [];

  const validImage = { buffer: PNG_MAGIC, filename: "work.png", mimeType: "image/png" };

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendorA = await prisma.vendor.create({
      data: { companyName: "Explore Test Vendor A", storefrontSlug: `explore-test-a-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorAId = vendorA.id;
    createdVendorIds.push(vendorA.id);

    const vendorB = await prisma.vendor.create({
      data: { companyName: "Explore Test Vendor B", storefrontSlug: `explore-test-b-${suffix}`, verificationStatus: "APPROVED" },
    });
    vendorBId = vendorB.id;
    createdVendorIds.push(vendorB.id);

    // A category slug this module's EXPLORE_CATEGORY_SLUGS allowlist accepts.
    const category = await prisma.category.upsert({
      where: { slug: "wigs" },
      create: { name: "Wigs", slug: "wigs" },
      update: {},
    });
    categoryId = category.id;
    createdCategoryIds.push(category.id);

    const userA = await prisma.user.create({
      data: { id: `explore-user-a-${suffix}`, name: "Explore User A", email: `explore.user.a.${suffix}@example.com` },
    });
    userAId = userA.id;
    createdUserIds.push(userA.id);

    const userB = await prisma.user.create({
      data: { id: `explore-user-b-${suffix}`, name: "Explore User B", email: `explore.user.b.${suffix}@example.com` },
    });
    userBId = userB.id;
    createdUserIds.push(userB.id);
  });

  afterAll(async () => {
    await prisma.explorePostLike.deleteMany({ where: { explorePostId: { in: createdPostIds } } });
    await prisma.explorePostSave.deleteMany({ where: { explorePostId: { in: createdPostIds } } });
    await prisma.explorePost.deleteMany({ where: { id: { in: createdPostIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  async function createSubmittedPost(vendorId: string, caption = "A completed hairstyle") {
    const result = await explorePostsService.createAndSubmit(vendorId, { caption, categoryId }, [validImage]);
    if (!result.ok) throw new Error(result.error);
    createdPostIds.push(result.value.postId);
    return result.value.postId;
  }

  // --- Creation / validation ---------------------------------------------

  it("creates and submits a post that is not yet publicly visible", async () => {
    const postId = await createSubmittedPost(vendorAId);
    const row = await prisma.explorePost.findUnique({ where: { id: postId } });
    expect(row?.approvalStatus).toBe("PENDING");
    expect(row?.visibility).toBe("DRAFT");
    expect(row?.submittedAt).not.toBeNull();

    const feed = await explorePostsService.getFeed({});
    expect(feed.rows.find((p) => p.id === postId)).toBeUndefined();
  });

  it("rejects a post with zero images", async () => {
    const result = await explorePostsService.createAndSubmit(vendorAId, { caption: "No photos", categoryId }, []);
    expect(result.ok).toBe(false);
  });

  it("rejects more than the maximum allowed images", async () => {
    const sevenImages = Array.from({ length: 7 }, () => validImage);
    const result = await explorePostsService.createAndSubmit(vendorAId, { caption: "Too many photos", categoryId }, sevenImages);
    expect(result.ok).toBe(false);
  });

  it("rejects a category outside the Explore allowlist", async () => {
    const commerceOnlyCategory = await prisma.category.upsert({
      where: { slug: "human-hair-bundles" },
      create: { name: "Human Hair Bundles", slug: "human-hair-bundles" },
      update: {},
    });
    const result = await explorePostsService.createAndSubmit(
      vendorAId,
      { caption: "Wrong category", categoryId: commerceOnlyCategory.id },
      [validImage],
    );
    expect(result.ok).toBe(false);
  });

  // --- Public feed ---------------------------------------------------

  it("excludes unpublished posts from the public feed", async () => {
    await createSubmittedPost(vendorAId, "Awaiting review");
    const feed = await explorePostsService.getFeed({});
    expect(feed.rows.length).toBe(0);
  });

  it("published posts appear newest-first with a working cursor", async () => {
    const firstId = await createSubmittedPost(vendorAId, "First post");
    await explorePostsService.approve(firstId);
    const secondId = await createSubmittedPost(vendorAId, "Second post");
    await explorePostsService.approve(secondId);

    const firstPage = await explorePostsService.getFeed({});
    expect(firstPage.rows.map((p) => p.id)).toEqual([secondId, firstId]);
  });

  it("newly published posts appear in the feed, in newest-first order relative to each other", async () => {
    // The public feed is global (not vendor/test-scoped), so this only
    // asserts this test's own posts are present and correctly ordered
    // relative to each other — not an exact total count, which would be
    // fragile against whatever else this file's other tests have already
    // published to the same shared category.
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const id = await createSubmittedPost(vendorAId, `Pagination test post ${i}`);
      await explorePostsService.approve(id);
      ids.push(id);
    }

    const page1 = await explorePostsService.getFeed({});
    const positions = ids.map((id) => page1.rows.findIndex((row) => row.id === id));
    expect(positions.every((index) => index !== -1)).toBe(true);
    // Newest-first: the last-created id must sort before the first-created id.
    expect(positions[2]).toBeLessThan(positions[0] as number);
  });

  // --- Authorization / ownership ------------------------------------------

  it("a vendor cannot edit another vendor's post", async () => {
    const postId = await createSubmittedPost(vendorAId);
    const result = await explorePostsService.updateAndResubmit(vendorBId, postId, { caption: "Hijacked", categoryId }, [], []);
    expect(result.ok).toBe(false);

    const own = await explorePostsService.getForVendor(vendorBId, postId);
    expect(own).toBeNull(); // vendor B cannot even read vendor A's post
  });

  it("a vendor cannot archive another vendor's post", async () => {
    const postId = await createSubmittedPost(vendorAId);
    await explorePostsService.approve(postId);
    const result = await explorePostsService.archive(vendorBId, postId);
    expect(result.ok).toBe(false);

    const row = await prisma.explorePost.findUnique({ where: { id: postId } });
    expect(row?.visibility).toBe("PUBLISHED");
  });

  // --- Moderation state machine ---------------------------------------

  it("approval publishes the post and notifies the owner", async () => {
    const postId = await createSubmittedPost(vendorAId);
    const result = await explorePostsService.approve(postId);
    expect(result.ok).toBe(true);

    const publiclyVisible = await prisma.explorePost.findFirst({
      where: { id: postId, approvalStatus: "APPROVED", visibility: "PUBLISHED" },
    });
    expect(publiclyVisible).not.toBeNull();
  });

  it("a PENDING first-time submission cannot be edited while awaiting its first decision", async () => {
    const postId = await createSubmittedPost(vendorAId);
    const result = await explorePostsService.updateAndResubmit(vendorAId, postId, { caption: "Edited", categoryId }, [], []);
    expect(result.ok).toBe(false);
  });

  it("editing an already-published post stages the change AND keeps the live version publicly visible throughout re-review (M21.1)", async () => {
    const postId = await createSubmittedPost(vendorAId, "Original caption");
    await explorePostsService.approve(postId);
    const originalImages = (await explorePostsService.getForVendor(vendorAId, postId))?.images ?? [];

    const editResult = await explorePostsService.updateAndResubmit(
      vendorAId,
      postId,
      { caption: "Updated caption", categoryId },
      [],
      originalImages,
    );
    expect(editResult.ok).toBe(true);

    const live = await prisma.explorePost.findUnique({ where: { id: postId } });
    expect(live?.caption).toBe("Original caption"); // live FIELD DATA untouched
    expect(live?.visibility).toBe("PUBLISHED");
    expect(live?.approvalStatus).toBe("PENDING"); // awaiting re-review
    expect(live?.pendingChanges).not.toBeNull();

    // M21.1 fix: the post remains public — and renders the OLD, still-
    // approved caption, never the proposed one — while its edit is under
    // review. The public feed query gates only on `visibility: PUBLISHED`,
    // never on `approvalStatus` (see repository.ts's listPublicFeed).
    const feedDuringReview = await explorePostsService.getFeed({});
    const publicRow = feedDuringReview.rows.find((p) => p.id === postId);
    expect(publicRow).toBeDefined();
    expect(publicRow?.caption).toBe("Original caption");

    // Same guarantee via direct single-post lookup (like()/save() depend on this).
    const singleLookup = await explorePostsService.like(postId, userAId);
    expect(singleLookup.ok).toBe(true);
    await explorePostsService.unlike(postId, userAId);

    await explorePostsService.approve(postId);
    const afterApproval = await prisma.explorePost.findUnique({ where: { id: postId } });
    expect(afterApproval?.caption).toBe("Updated caption");
    expect(afterApproval?.pendingChanges).toBeNull();

    const feedAfterApproval = await explorePostsService.getFeed({});
    expect(feedAfterApproval.rows.find((p) => p.id === postId)?.caption).toBe("Updated caption");
  });

  it("requestChanges on a published post's edit keeps the live version public and unchanged (M21.1)", async () => {
    const postId = await createSubmittedPost(vendorAId, "Original caption");
    await explorePostsService.approve(postId);
    const originalImages = (await explorePostsService.getForVendor(vendorAId, postId))?.images ?? [];
    await explorePostsService.updateAndResubmit(vendorAId, postId, { caption: "Proposed caption", categoryId }, [], originalImages);

    const result = await explorePostsService.requestChanges(postId, "Please retake this photo in better light");
    expect(result.ok).toBe(true);

    const row = await prisma.explorePost.findUnique({ where: { id: postId } });
    expect(row?.caption).toBe("Original caption"); // live content untouched
    expect(row?.visibility).toBe("PUBLISHED");
    expect(row?.approvalStatus).toBe("CHANGES_REQUESTED");
    expect(row?.pendingChanges).not.toBeNull(); // proposal preserved for the vendor to fix

    const feed = await explorePostsService.getFeed({});
    const publicRow = feed.rows.find((p) => p.id === postId);
    expect(publicRow).toBeDefined(); // still public
    expect(publicRow?.caption).toBe("Original caption"); // renders live, never the pending proposal
  });

  it("a saved post stays in the user's saved list while its own edit is under re-review (M21.1)", async () => {
    const postId = await createSubmittedPost(vendorAId, "Original caption");
    await explorePostsService.approve(postId);
    await explorePostsService.save(postId, userAId);
    const originalImages = (await explorePostsService.getForVendor(vendorAId, postId))?.images ?? [];

    await explorePostsService.updateAndResubmit(vendorAId, postId, { caption: "Proposed caption", categoryId }, [], originalImages);

    const saved = await explorePostsService.getSaved(userAId);
    const savedRow = saved.rows.find((p) => p.id === postId);
    expect(savedRow).toBeDefined();
    expect(savedRow?.caption).toBe("Original caption");
  });

  it("newly submitted (never-approved) posts are never publicly visible (M21.1 §1)", async () => {
    const postId = await createSubmittedPost(vendorAId, "Awaiting first review");
    expect((await explorePostsService.getFeed({})).rows.some((p) => p.id === postId)).toBe(false);
    const single = await explorePostsService.like(postId, userAId);
    expect(single.ok).toBe(false); // findPublicById also gates on visibility: PUBLISHED
  });

  it("a rejected never-approved post is never publicly visible (M21.1 §2)", async () => {
    const postId = await createSubmittedPost(vendorAId, "Will be rejected");
    await explorePostsService.reject(postId, "Not a good fit for Explore");
    const row = await prisma.explorePost.findUnique({ where: { id: postId } });
    expect(row?.visibility).toBe("DRAFT");
    expect((await explorePostsService.getFeed({})).rows.some((p) => p.id === postId)).toBe(false);
  });

  it("an archived post is never publicly visible, even mid-edit (M21.1 §3)", async () => {
    const postId = await createSubmittedPost(vendorAId, "Will be archived");
    await explorePostsService.approve(postId);
    await explorePostsService.archive(vendorAId, postId);
    expect((await explorePostsService.getFeed({})).rows.some((p) => p.id === postId)).toBe(false);

    const saveResult = await explorePostsService.save(postId, userAId);
    expect(saveResult.ok).toBe(false); // an archived post cannot be newly saved either
  });

  it("likes/saves recorded before an edit remain attached to the same post through re-review and reapproval (M21.1 §10)", async () => {
    const postId = await createSubmittedPost(vendorAId, "Original caption");
    await explorePostsService.approve(postId);
    await explorePostsService.like(postId, userAId);
    await explorePostsService.save(postId, userAId);
    const originalImages = (await explorePostsService.getForVendor(vendorAId, postId))?.images ?? [];

    await explorePostsService.updateAndResubmit(vendorAId, postId, { caption: "Updated caption", categoryId }, [], originalImages);
    await explorePostsService.approve(postId);

    const likeCount = await prisma.explorePostLike.count({ where: { explorePostId: postId, userId: userAId } });
    const saveCount = await prisma.explorePostSave.count({ where: { explorePostId: postId, userId: userAId } });
    expect(likeCount).toBe(1);
    expect(saveCount).toBe(1);

    const feed = await explorePostsService.getFeed({ viewerUserId: userAId });
    const row = feed.rows.find((p) => p.id === postId);
    expect(row).toBeDefined();
    expect(feed.likedIds.has(postId)).toBe(true);
    expect(feed.savedIds.has(postId)).toBe(true);
  });

  it("feed cursor ordering is unaffected by an in-flight edit (M21.1 §11)", async () => {
    const olderPostId = await createSubmittedPost(vendorAId, "Older post");
    await explorePostsService.approve(olderPostId);
    const newerPostId = await createSubmittedPost(vendorAId, "Newer post");
    await explorePostsService.approve(newerPostId);
    const originalImages = (await explorePostsService.getForVendor(vendorAId, olderPostId))?.images ?? [];

    // Editing the OLDER post (which does not change its createdAt) must not
    // change its relative feed position.
    await explorePostsService.updateAndResubmit(vendorAId, olderPostId, { caption: "Older post, edited", categoryId }, [], originalImages);

    const feed = await explorePostsService.getFeed({});
    const olderIndex = feed.rows.findIndex((p) => p.id === olderPostId);
    const newerIndex = feed.rows.findIndex((p) => p.id === newerPostId);
    expect(olderIndex).toBeGreaterThan(-1);
    expect(newerIndex).toBeGreaterThan(-1);
    expect(newerIndex).toBeLessThan(olderIndex); // newest-first, unchanged by the edit
  });

  it("admin detail exposes the PROPOSED pendingChanges for an edit-in-review, distinct from the live values (M21.1 §6/§7)", async () => {
    const postId = await createSubmittedPost(vendorAId, "Original caption");
    await explorePostsService.approve(postId);
    const originalImages = (await explorePostsService.getForVendor(vendorAId, postId))?.images ?? [];
    await explorePostsService.updateAndResubmit(
      vendorAId,
      postId,
      { caption: "Proposed caption", categoryId },
      [validImage],
      originalImages,
    );

    const adminView = await explorePostsService.getForAdmin(postId);
    expect(adminView?.caption).toBe("Original caption"); // live value, untouched
    expect(adminView?.pendingChanges).not.toBeNull();
    expect(adminView?.pendingChanges?.caption).toBe("Proposed caption");
    // Every proposed image is visible to admin, not just the kept ones.
    expect(adminView?.pendingChanges?.images.length).toBe(originalImages.length + 1);
  });

  it("rejecting an edit-in-review discards the proposal and keeps the live post untouched", async () => {
    const postId = await createSubmittedPost(vendorAId, "Original caption");
    await explorePostsService.approve(postId);
    const keptImages = (await explorePostsService.getForVendor(vendorAId, postId))?.images ?? [];
    await explorePostsService.updateAndResubmit(vendorAId, postId, { caption: "Bad edit", categoryId }, [], keptImages);

    const result = await explorePostsService.reject(postId, "Not consistent with our guidelines");
    expect(result.ok).toBe(true);

    const row = await prisma.explorePost.findUnique({ where: { id: postId } });
    expect(row?.caption).toBe("Original caption");
    expect(row?.approvalStatus).toBe("APPROVED");
    expect(row?.visibility).toBe("PUBLISHED");
    expect(row?.pendingChanges).toBeNull();
  });

  it("requestChanges lets the vendor edit and resubmit", async () => {
    const postId = await createSubmittedPost(vendorAId, "First attempt");
    await explorePostsService.requestChanges(postId, "Please add a clearer photo");

    const edit = await explorePostsService.updateAndResubmit(vendorAId, postId, { caption: "Second attempt", categoryId }, [validImage], []);
    expect(edit.ok).toBe(true);

    const row = await prisma.explorePost.findUnique({ where: { id: postId } });
    expect(row?.approvalStatus).toBe("PENDING");
    expect(row?.caption).toBe("Second attempt");
  });

  // --- Archive ---------------------------------------------------------

  it("archiving removes a post from the public feed", async () => {
    const postId = await createSubmittedPost(vendorAId);
    await explorePostsService.approve(postId);
    expect((await explorePostsService.getFeed({})).rows.some((p) => p.id === postId)).toBe(true);

    const archiveResult = await explorePostsService.archive(vendorAId, postId);
    expect(archiveResult.ok).toBe(true);

    const feed = await explorePostsService.getFeed({});
    expect(feed.rows.some((p) => p.id === postId)).toBe(false);
  });

  it("only a PUBLISHED post can be archived", async () => {
    const postId = await createSubmittedPost(vendorAId);
    const result = await explorePostsService.archive(vendorAId, postId);
    expect(result.ok).toBe(false);
  });

  // --- Likes / saves — idempotency, no anonymous engagement ---------------

  it("liking is idempotent — repeated likes never create duplicate rows", async () => {
    const postId = await createSubmittedPost(vendorAId);
    await explorePostsService.approve(postId);

    await explorePostsService.like(postId, userAId);
    await explorePostsService.like(postId, userAId);
    await explorePostsService.like(postId, userAId);

    const count = await prisma.explorePostLike.count({ where: { explorePostId: postId, userId: userAId } });
    expect(count).toBe(1);

    const feed = await explorePostsService.getFeed({});
    expect(feed.rows.find((p) => p.id === postId)?.likeCount).toBe(1);
  });

  it("unliking is idempotent and removes the like", async () => {
    const postId = await createSubmittedPost(vendorAId);
    await explorePostsService.approve(postId);
    await explorePostsService.like(postId, userAId);

    await explorePostsService.unlike(postId, userAId);
    await explorePostsService.unlike(postId, userAId); // idempotent — no error

    const count = await prisma.explorePostLike.count({ where: { explorePostId: postId, userId: userAId } });
    expect(count).toBe(0);
  });

  it("likedByMe/savedByMe reflect the viewing user only, not other users' engagement", async () => {
    const postId = await createSubmittedPost(vendorAId);
    await explorePostsService.approve(postId);
    await explorePostsService.like(postId, userAId);
    await explorePostsService.save(postId, userAId);

    const feedForA = await explorePostsService.getFeed({ viewerUserId: userAId });
    const postForA = feedForA.rows.find((p) => p.id === postId);
    expect(feedForA.likedIds.has(postId)).toBe(true);
    expect(feedForA.savedIds.has(postId)).toBe(true);
    expect(postForA).toBeDefined();

    const feedForB = await explorePostsService.getFeed({ viewerUserId: userBId });
    expect(feedForB.likedIds.has(postId)).toBe(false);
    expect(feedForB.savedIds.has(postId)).toBe(false);

    const anonymousFeed = await explorePostsService.getFeed({});
    expect(anonymousFeed.likedIds.size).toBe(0);
    expect(anonymousFeed.savedIds.size).toBe(0);
  });

  it("saving is idempotent and the saved list returns exactly the user's saved published posts", async () => {
    const postId = await createSubmittedPost(vendorAId);
    await explorePostsService.approve(postId);

    await explorePostsService.save(postId, userAId);
    await explorePostsService.save(postId, userAId);

    const count = await prisma.explorePostSave.count({ where: { explorePostId: postId, userId: userAId } });
    expect(count).toBe(1);

    const saved = await explorePostsService.getSaved(userAId);
    expect(saved.rows.map((p) => p.id)).toContain(postId);

    const savedForOther = await explorePostsService.getSaved(userBId);
    expect(savedForOther.rows.map((p) => p.id)).not.toContain(postId);
  });

  it("archiving a post removes it from a user's saved list", async () => {
    const postId = await createSubmittedPost(vendorAId);
    await explorePostsService.approve(postId);
    await explorePostsService.save(postId, userAId);

    await explorePostsService.archive(vendorAId, postId);

    const saved = await explorePostsService.getSaved(userAId);
    expect(saved.rows.map((p) => p.id)).not.toContain(postId);
  });

  it("liking/saving a nonexistent or unpublished post fails cleanly", async () => {
    const draftPostId = await createSubmittedPost(vendorAId, "Still pending");
    const likeResult = await explorePostsService.like(draftPostId, userAId);
    expect(likeResult.ok).toBe(false);

    const saveResult = await explorePostsService.save("nonexistent-id", userAId);
    expect(saveResult.ok).toBe(false);
  });
});
