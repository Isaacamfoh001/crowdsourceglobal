import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { paginationSkip } from "../../lib/pagination";
import { EXPLORE_CATEGORY_SLUGS } from "../../prisma/reference-data";
import type { ExplorePostPendingChangesPayload } from "./types";

function toImages(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

function parsePendingChanges(value: unknown): ExplorePostPendingChangesPayload | null {
  if (!value || typeof value !== "object") return null;
  return value as ExplorePostPendingChangesPayload;
}

/**
 * Opaque cursor for the public feed — `createdAt desc, id desc` encoded as
 * base64 `<iso-timestamp>|<id>`. A malformed/tampered cursor is simply
 * treated as "no cursor" (start from the top) rather than erroring — feed
 * cursors are a paging convenience, not an authorization boundary.
 */
export function encodeExploreFeedCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

function decodeExploreFeedCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const separatorIndex = decoded.lastIndexOf("|");
    if (separatorIndex === -1) return null;
    const createdAt = new Date(decoded.slice(0, separatorIndex));
    const id = decoded.slice(separatorIndex + 1);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

const publicFeedSelect = {
  id: true,
  caption: true,
  images: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  vendor: {
    select: { id: true, companyName: true, logoUrl: true, storefrontSlug: true, country: true, region: true, city: true },
  },
  _count: { select: { likes: true } },
} as const;

function toPublicPost(row: {
  id: string;
  caption: string;
  images: unknown;
  createdAt: Date;
  category: { id: string; name: string; slug: string };
  vendor: {
    id: string;
    companyName: string;
    logoUrl: string | null;
    storefrontSlug: string;
    country: string | null;
    region: string | null;
    city: string | null;
  };
  _count: { likes: number };
}) {
  return {
    id: row.id,
    caption: row.caption,
    images: toImages(row.images),
    createdAt: row.createdAt,
    category: row.category,
    vendor: row.vendor,
    likeCount: row._count.likes,
  };
}

const detailInclude = {};

function toVendorDetail(row: {
  id: string;
  caption: string;
  images: unknown;
  approvalStatus: string;
  visibility: string;
  categoryId: string;
  submittedAt: Date | null;
  changesRequestedReason: string | null;
  pendingChanges: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    caption: row.caption,
    images: toImages(row.images),
    approvalStatus: row.approvalStatus,
    visibility: row.visibility,
    hasPendingChanges: row.pendingChanges !== null,
    changesRequestedReason: row.changesRequestedReason,
    categoryId: row.categoryId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const explorePostsRepository = {
  /**
   * The fixed Explore category allowlist (prisma/reference-data.ts),
   * resolved to real rows — backs the mobile create-post category picker
   * and the public category-filter param. Never the full commerce taxonomy
   * (most of which has no meaning as a "type of beauty work").
   */
  listExploreCategories() {
    return prisma.category.findMany({
      where: { slug: { in: EXPLORE_CATEGORY_SLUGS } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
  },

  /**
   * Public feed — every post with `visibility: PUBLISHED`, newest first
   * with a stable (createdAt, id) cursor. Fetches `pageSize + 1` rows to
   * determine `nextCursor` without a separate count() query (a feed has no
   * "total pages" concept, unlike the page-number lists elsewhere in this
   * codebase — see lib/pagination.ts's own doc comment for why that
   * convention doesn't fit here).
   *
   * (M21.1) Deliberately NOT also filtered on `approvalStatus: APPROVED`.
   * `visibility` flips to PUBLISHED exactly once — the moment a post is
   * first approved (`applyApprovalAndPublish`) — and is only ever cleared
   * by an explicit archive. It is NEVER reset when a published post's
   * material edit is submitted for re-review (that only moves
   * `approvalStatus` back to PENDING/CHANGES_REQUESTED while the proposal
   * sits in `pendingChanges`). So `visibility: PUBLISHED` alone is exactly
   * "this post has been approved at least once and hasn't been archived
   * since" — the correct public-visibility gate regardless of whether a
   * re-review is in flight. Requiring `approvalStatus: APPROVED` here too
   * was the M21 bug: it made an already-live post vanish from the public
   * feed the instant its owner submitted an edit, even though the OLD,
   * still-approved content (the row's own live fields — this query never
   * reads `pendingChanges`) was still perfectly valid to show. A
   * never-yet-approved post (`visibility: DRAFT`) and an archived one
   * (`visibility: ARCHIVED`) both correctly stay excluded either way. See
   * prisma/schema.prisma's ExplorePost doc comment for the full state
   * table.
   */
  async listPublicFeed(params: { categoryId?: string; cursor?: string }, pageSize: number) {
    const decodedCursor = params.cursor ? decodeExploreFeedCursor(params.cursor) : null;

    const rows = await prisma.explorePost.findMany({
      where: {
        visibility: "PUBLISHED",
        ...(params.categoryId ? { categoryId: params.categoryId } : {}),
        ...(decodedCursor
          ? {
              OR: [
                { createdAt: { lt: decodedCursor.createdAt } },
                { createdAt: decodedCursor.createdAt, id: { lt: decodedCursor.id } },
              ],
            }
          : {}),
      },
      select: publicFeedSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const last = pageRows[pageRows.length - 1];
    return {
      rows: pageRows.map(toPublicPost),
      nextCursor: hasMore && last ? encodeExploreFeedCursor(last) : null,
    };
  },

  /** Same `visibility: PUBLISHED`-only gate as listPublicFeed — see its doc comment (M21.1). Used by like()/save() to validate a post is currently public before recording engagement against it. */
  async findPublicById(id: string) {
    const row = await prisma.explorePost.findFirst({
      where: { id, visibility: "PUBLISHED" },
      select: publicFeedSelect,
    });
    return row ? toPublicPost(row) : null;
  },

  /** Which of `postIds` the given user has liked/saved — used to compute `likedByMe`/`savedByMe` for a signed-in feed request. */
  async findEngagedPostIds(userId: string, postIds: string[]) {
    const [likes, saves] = await Promise.all([
      prisma.explorePostLike.findMany({ where: { userId, explorePostId: { in: postIds } }, select: { explorePostId: true } }),
      prisma.explorePostSave.findMany({ where: { userId, explorePostId: { in: postIds } }, select: { explorePostId: true } }),
    ]);
    return {
      likedIds: new Set(likes.map((row) => row.explorePostId)),
      savedIds: new Set(saves.map((row) => row.explorePostId)),
    };
  },

  async listSavedForUser(userId: string, params: { cursor?: string }, pageSize: number) {
    const decodedCursor = params.cursor ? decodeExploreFeedCursor(params.cursor) : null;

    const saveRows = await prisma.explorePostSave.findMany({
      where: {
        userId,
        // A post can be archived after being saved — never surface it back
        // to the user (§10's saved list is a discovery convenience, not an
        // archive of everything ever saved). Same `visibility: PUBLISHED`-
        // only gate as listPublicFeed (M21.1) — a saved post stays visible
        // here while one of its own edits is under re-review, same as the
        // main feed.
        explorePost: { visibility: "PUBLISHED" },
        ...(decodedCursor
          ? {
              OR: [
                { createdAt: { lt: decodedCursor.createdAt } },
                { createdAt: decodedCursor.createdAt, id: { lt: decodedCursor.id } },
              ],
            }
          : {}),
      },
      select: { id: true, createdAt: true, explorePost: { select: publicFeedSelect } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
    });

    const hasMore = saveRows.length > pageSize;
    const pageRows = hasMore ? saveRows.slice(0, pageSize) : saveRows;
    const last = pageRows[pageRows.length - 1];
    return {
      rows: pageRows.map((row) => toPublicPost(row.explorePost)),
      nextCursor: hasMore && last ? encodeExploreFeedCursor(last) : null,
    };
  },

  // --- Engagement (like/save) — idempotent, never anonymous -------------

  async like(explorePostId: string, userId: string): Promise<void> {
    try {
      await prisma.explorePostLike.create({ data: { explorePostId, userId } });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      // Already liked — idempotent no-op (CLAUDE.md M21 §9).
    }
  },

  async unlike(explorePostId: string, userId: string): Promise<void> {
    await prisma.explorePostLike.deleteMany({ where: { explorePostId, userId } });
  },

  async save(explorePostId: string, userId: string): Promise<void> {
    try {
      await prisma.explorePostSave.create({ data: { explorePostId, userId } });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
    }
  },

  async unsave(explorePostId: string, userId: string): Promise<void> {
    await prisma.explorePostSave.deleteMany({ where: { explorePostId, userId } });
  },

  // --- Vendor (own posts) -------------------------------------------------

  async findSummariesForVendorPaginated(vendorId: string, page: number, pageSize: number) {
    const where = { vendorId };
    const [rows, total] = await Promise.all([
      prisma.explorePost.findMany({
        where,
        select: {
          id: true,
          caption: true,
          images: true,
          approvalStatus: true,
          visibility: true,
          categoryId: true,
          submittedAt: true,
          changesRequestedReason: true,
          pendingChanges: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.explorePost.count({ where }),
    ]);
    return { rows: rows.map(toVendorDetail), total };
  },

  async findForVendor(vendorId: string, id: string) {
    const row = await prisma.explorePost.findFirst({
      where: { id, vendorId },
      select: {
        id: true,
        caption: true,
        images: true,
        approvalStatus: true,
        visibility: true,
        categoryId: true,
        submittedAt: true,
        changesRequestedReason: true,
        pendingChanges: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return row ? toVendorDetail(row) : null;
  },

  createAndSubmit(vendorId: string, input: { caption: string; categoryId: string; images: string[] }) {
    return prisma.explorePost.create({
      data: {
        vendorId,
        categoryId: input.categoryId,
        caption: input.caption,
        images: input.images,
        approvalStatus: "PENDING",
        submittedAt: new Date(),
      },
      select: { id: true },
    });
  },

  /** Ownership-scoped — only ever affects a row owned by `vendorId`. */
  async updateFieldsForVendor(vendorId: string, id: string, data: Record<string, unknown>): Promise<boolean> {
    const result = await prisma.explorePost.updateMany({ where: { id, vendorId }, data });
    return result.count > 0;
  },

  /** Unpublish — only a currently-PUBLISHED post owned by `vendorId` can be archived. */
  async archiveForVendor(vendorId: string, id: string): Promise<boolean> {
    const result = await prisma.explorePost.updateMany({
      where: { id, vendorId, visibility: "PUBLISHED" },
      data: { visibility: "ARCHIVED" },
    });
    return result.count > 0;
  },

  // --- Admin ---------------------------------------------------------

  async findPendingForAdminPaginated(page: number, pageSize: number) {
    const where = { approvalStatus: "PENDING" as const, submittedAt: { not: null } };
    const [rows, total] = await Promise.all([
      prisma.explorePost.findMany({
        where,
        select: {
          id: true,
          caption: true,
          approvalStatus: true,
          visibility: true,
          pendingChanges: true,
          submittedAt: true,
          updatedAt: true,
          vendor: { select: { id: true, companyName: true } },
        },
        // Oldest-first — same deliberate queue order as vendor-listings'
        // moderation queue (docs/architecture/overview.md's pagination
        // section: the two admin queues kept oldest-first by design).
        orderBy: { updatedAt: "asc" },
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.explorePost.count({ where }),
    ]);
    return {
      rows: rows.map((row) => ({
        id: row.id,
        caption: row.caption,
        approvalStatus: row.approvalStatus,
        visibility: row.visibility,
        isEdit: row.pendingChanges !== null,
        vendorId: row.vendor.id,
        vendorName: row.vendor.companyName,
        submittedAt: row.submittedAt as Date,
        updatedAt: row.updatedAt,
      })),
      total,
    };
  },

  async findForAdmin(id: string) {
    const row = await prisma.explorePost.findUnique({
      where: { id },
      include: { ...detailInclude, category: { select: { id: true, name: true } }, vendor: { select: { id: true, companyName: true } } },
    });
    if (!row) return null;
    return {
      id: row.id,
      caption: row.caption,
      images: toImages(row.images),
      approvalStatus: row.approvalStatus,
      visibility: row.visibility,
      categoryId: row.categoryId,
      category: row.category,
      pendingChanges: parsePendingChanges(row.pendingChanges),
      vendorId: row.vendor.id,
      vendorName: row.vendor.companyName,
      submittedAt: row.submittedAt,
    };
  },

  applyApprovalAndPublish(id: string, fields: { caption: string; categoryId: string; images: string[] } | null) {
    return prisma.explorePost.update({
      where: { id },
      data: {
        ...(fields ?? {}),
        approvalStatus: "APPROVED",
        visibility: "PUBLISHED",
        pendingChanges: Prisma.JsonNull,
        changesRequestedReason: null,
      },
    });
  },

  requestChanges(id: string, reason: string) {
    return prisma.explorePost.update({
      where: { id },
      data: { approvalStatus: "CHANGES_REQUESTED", changesRequestedReason: reason },
    });
  },

  /** First-time-submission rejection — post stays DRAFT/never-public. */
  reject(id: string, reason: string) {
    return prisma.explorePost.update({
      where: { id },
      data: { approvalStatus: "REJECTED", changesRequestedReason: reason },
    });
  },

  /** Edit-to-a-live-post rejection — discard the proposal, keep the live version untouched. */
  discardPendingChanges(id: string) {
    return prisma.explorePost.update({
      where: { id },
      data: { approvalStatus: "APPROVED", pendingChanges: Prisma.JsonNull, changesRequestedReason: null },
    });
  },
};

function isUniqueConstraintViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
