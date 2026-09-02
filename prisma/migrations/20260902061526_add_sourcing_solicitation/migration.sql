-- CreateEnum
CREATE TYPE "SourcingSolicitationStatus" AS ENUM ('SENT', 'RESPONDED', 'CANNOT_FULFIL');

-- AlterTable
ALTER TABLE "sourcing_option" ADD COLUMN     "sourcingSolicitationId" TEXT;

-- CreateTable
CREATE TABLE "sourcing_solicitation" (
    "id" TEXT NOT NULL,
    "status" "SourcingSolicitationStatus" NOT NULL DEFAULT 'SENT',
    "sourcingRequestId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "proposedQuantity" INTEGER,
    "unitPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourcing_solicitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sourcing_solicitation_sourcingRequestId_idx" ON "sourcing_solicitation"("sourcingRequestId");

-- CreateIndex
CREATE INDEX "sourcing_solicitation_vendorId_status_idx" ON "sourcing_solicitation"("vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sourcing_solicitation_sourcingRequestId_vendorId_key" ON "sourcing_solicitation"("sourcingRequestId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "sourcing_option_sourcingSolicitationId_key" ON "sourcing_option"("sourcingSolicitationId");

-- AddForeignKey
ALTER TABLE "sourcing_option" ADD CONSTRAINT "sourcing_option_sourcingSolicitationId_fkey" FOREIGN KEY ("sourcingSolicitationId") REFERENCES "sourcing_solicitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_solicitation" ADD CONSTRAINT "sourcing_solicitation_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "custom_sourcing_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_solicitation" ADD CONSTRAINT "sourcing_solicitation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

