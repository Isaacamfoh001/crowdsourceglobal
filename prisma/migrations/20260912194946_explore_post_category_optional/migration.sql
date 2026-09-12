-- DropForeignKey
ALTER TABLE "explore_post" DROP CONSTRAINT "explore_post_categoryId_fkey";

-- AlterTable
ALTER TABLE "explore_post" ALTER COLUMN "categoryId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "explore_post" ADD CONSTRAINT "explore_post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
