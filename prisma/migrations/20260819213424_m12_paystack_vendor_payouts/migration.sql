-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SettlementStatus" ADD VALUE 'PROCESSING';
ALTER TYPE "SettlementStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "vendor_settlement" ADD COLUMN     "payoutFailureReasonSafe" TEXT,
ADD COLUMN     "payoutInitiatedAt" TIMESTAMP(3),
ADD COLUMN     "payoutInitiatedByUserId" TEXT,
ADD COLUMN     "payoutProvider" TEXT,
ADD COLUMN     "payoutProviderRecipientCode" TEXT,
ADD COLUMN     "payoutProviderReference" TEXT,
ADD COLUMN     "payoutProviderTransferCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "vendor_settlement_payoutProviderReference_key" ON "vendor_settlement"("payoutProviderReference");

