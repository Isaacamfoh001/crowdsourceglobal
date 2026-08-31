-- AlterTable
ALTER TABLE "talent_application" ADD COLUMN     "portfolioLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];
