
-- CreateEnum
CREATE TYPE "EarningStatus" AS ENUM ('PENDING', 'ON_HOLD', 'ELIGIBLE', 'INCLUDED_IN_SETTLEMENT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdjustmentCategory" AS ENUM ('RESOLUTION_REFUND', 'MANUAL_CORRECTION', 'SETTLEMENT_REVERSAL');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "PayoutDestinationType" AS ENUM ('MOBILE_MONEY', 'BANK_TRANSFER');

-- AlterTable
ALTER TABLE "fulfilment_item" DROP COLUMN "payoutEligibility";

-- DropEnum
DROP TYPE "PayoutEligibility";

-- CreateTable
CREATE TABLE "vendor_earning" (
    "id" TEXT NOT NULL,
    "status" "EarningStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "originalPayableAmount" DECIMAL(12,2) NOT NULL,
    "holdReasonSafe" TEXT,
    "holdInternalNote" TEXT,
    "heldAt" TIMESTAMP(3),
    "heldByUserId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releasedByUserId" TEXT,
    "eligibleAt" TIMESTAMP(3),
    "vendorId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fulfilmentId" TEXT NOT NULL,
    "fulfilmentItemId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_earning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_financial_adjustment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" "AdjustmentCategory" NOT NULL,
    "reason" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorEarningId" TEXT NOT NULL,
    "resolutionCaseId" TEXT,
    "appliedToSettlementId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_financial_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_settlement" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "grossPayable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustmentTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "destinationSnapshot" JSONB,
    "payoutMethod" "PayoutMethod",
    "payoutExternalReference" TEXT,
    "payoutNote" TEXT,
    "payoutPaidAt" TIMESTAMP(3),
    "payoutRecordedByUserId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversalReason" TEXT,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_settlement_item" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "settlementId" TEXT NOT NULL,
    "vendorEarningId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_settlement_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_payout_destination" (
    "id" TEXT NOT NULL,
    "type" "PayoutDestinationType" NOT NULL,
    "momoAccountName" TEXT,
    "momoPhone" TEXT,
    "momoNetwork" "PaymentNetwork",
    "bankAccountName" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "updatedByUserId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_payout_destination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_earning_fulfilmentItemId_key" ON "vendor_earning"("fulfilmentItemId");

-- CreateIndex
CREATE INDEX "vendor_earning_vendorId_status_idx" ON "vendor_earning"("vendorId", "status");

-- CreateIndex
CREATE INDEX "vendor_earning_orderId_idx" ON "vendor_earning"("orderId");

-- CreateIndex
CREATE INDEX "vendor_earning_status_eligibleAt_idx" ON "vendor_earning"("status", "eligibleAt");

-- CreateIndex
CREATE INDEX "vendor_financial_adjustment_vendorId_appliedToSettlementId_idx" ON "vendor_financial_adjustment"("vendorId", "appliedToSettlementId");

-- CreateIndex
CREATE INDEX "vendor_financial_adjustment_vendorEarningId_idx" ON "vendor_financial_adjustment"("vendorEarningId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_settlement_settlementNumber_key" ON "vendor_settlement"("settlementNumber");

-- CreateIndex
CREATE INDEX "vendor_settlement_vendorId_status_idx" ON "vendor_settlement"("vendorId", "status");

-- CreateIndex
CREATE INDEX "vendor_settlement_status_createdAt_idx" ON "vendor_settlement"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_settlement_item_vendorEarningId_key" ON "vendor_settlement_item"("vendorEarningId");

-- CreateIndex
CREATE INDEX "vendor_settlement_item_settlementId_idx" ON "vendor_settlement_item"("settlementId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_payout_destination_vendorId_key" ON "vendor_payout_destination"("vendorId");

-- AddForeignKey
ALTER TABLE "vendor_earning" ADD CONSTRAINT "vendor_earning_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_earning" ADD CONSTRAINT "vendor_earning_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_earning" ADD CONSTRAINT "vendor_earning_fulfilmentId_fkey" FOREIGN KEY ("fulfilmentId") REFERENCES "fulfilment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_earning" ADD CONSTRAINT "vendor_earning_fulfilmentItemId_fkey" FOREIGN KEY ("fulfilmentItemId") REFERENCES "fulfilment_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_earning" ADD CONSTRAINT "vendor_earning_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_financial_adjustment" ADD CONSTRAINT "vendor_financial_adjustment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_financial_adjustment" ADD CONSTRAINT "vendor_financial_adjustment_vendorEarningId_fkey" FOREIGN KEY ("vendorEarningId") REFERENCES "vendor_earning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_financial_adjustment" ADD CONSTRAINT "vendor_financial_adjustment_resolutionCaseId_fkey" FOREIGN KEY ("resolutionCaseId") REFERENCES "resolution_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_financial_adjustment" ADD CONSTRAINT "vendor_financial_adjustment_appliedToSettlementId_fkey" FOREIGN KEY ("appliedToSettlementId") REFERENCES "vendor_settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_settlement" ADD CONSTRAINT "vendor_settlement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_settlement_item" ADD CONSTRAINT "vendor_settlement_item_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "vendor_settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_settlement_item" ADD CONSTRAINT "vendor_settlement_item_vendorEarningId_fkey" FOREIGN KEY ("vendorEarningId") REFERENCES "vendor_earning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_payout_destination" ADD CONSTRAINT "vendor_payout_destination_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

