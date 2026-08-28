-- CreateEnum
CREATE TYPE "ExplorePostVisibility" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'EXPLORE_POST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'EXPLORE_POST_CHANGES_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'EXPLORE_POST_REJECTED';

-- CreateTable
CREATE TABLE "explore_post" (
    "id" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "images" JSONB NOT NULL DEFAULT '[]',
    "approvalStatus" "ListingApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "ExplorePostVisibility" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "pendingChanges" JSONB,
    "changesRequestedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "explore_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "explore_post_like" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "explorePostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "explore_post_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "explore_post_save" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "explorePostId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "explore_post_save_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "explore_post_vendorId_idx" ON "explore_post"("vendorId");

-- CreateIndex
CREATE INDEX "explore_post_categoryId_idx" ON "explore_post"("categoryId");

-- CreateIndex
CREATE INDEX "explore_post_approvalStatus_visibility_createdAt_idx" ON "explore_post"("approvalStatus", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "explore_post_approvalStatus_submittedAt_idx" ON "explore_post"("approvalStatus", "submittedAt");

-- CreateIndex
CREATE INDEX "explore_post_like_explorePostId_idx" ON "explore_post_like"("explorePostId");

-- CreateIndex
CREATE INDEX "explore_post_like_userId_idx" ON "explore_post_like"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "explore_post_like_explorePostId_userId_key" ON "explore_post_like"("explorePostId", "userId");

-- CreateIndex
CREATE INDEX "explore_post_save_explorePostId_idx" ON "explore_post_save"("explorePostId");

-- CreateIndex
CREATE INDEX "explore_post_save_userId_idx" ON "explore_post_save"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "explore_post_save_explorePostId_userId_key" ON "explore_post_save"("explorePostId", "userId");

-- AddForeignKey
ALTER TABLE "explore_post" ADD CONSTRAINT "explore_post_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "explore_post" ADD CONSTRAINT "explore_post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "explore_post_like" ADD CONSTRAINT "explore_post_like_explorePostId_fkey" FOREIGN KEY ("explorePostId") REFERENCES "explore_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "explore_post_like" ADD CONSTRAINT "explore_post_like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "explore_post_save" ADD CONSTRAINT "explore_post_save_explorePostId_fkey" FOREIGN KEY ("explorePostId") REFERENCES "explore_post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "explore_post_save" ADD CONSTRAINT "explore_post_save_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
