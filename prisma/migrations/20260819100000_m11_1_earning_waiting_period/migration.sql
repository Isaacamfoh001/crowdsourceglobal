-- AlterEnum
ALTER TYPE "EarningStatus" ADD VALUE 'WAITING_PERIOD';

-- AlterTable
ALTER TABLE "vendor_earning" ADD COLUMN     "deliveredAt" TIMESTAMP(3);

