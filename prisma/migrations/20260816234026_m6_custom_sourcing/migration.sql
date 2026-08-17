-- CreateEnum
CREATE TYPE "SourcingRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SOURCING', 'AWAITING_CUSTOMER', 'QUOTED', 'ACCEPTED', 'UNABLE_TO_SOURCE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SourcingOptionSourceType" AS ENUM ('VENDOR_LISTING', 'VENDOR', 'EXTERNAL_SUPPLIER');

-- AlterEnum
ALTER TYPE "ConversationContextType" ADD VALUE 'SOURCING_REQUEST';

-- AlterEnum
ALTER TYPE "QuotationOrigin" ADD VALUE 'CUSTOM_SOURCING';

-- AlterEnum
ALTER TYPE "QuotationStatus" ADD VALUE 'SUPERSEDED';

-- AlterTable
ALTER TABLE "conversation" ADD COLUMN     "contextSourcingRequestId" TEXT;

-- AlterTable
ALTER TABLE "quotation" ADD COLUMN     "sourcingRequestId" TEXT,
ADD COLUMN     "supersedesQuotationId" TEXT;

-- CreateTable
CREATE TABLE "custom_sourcing_request" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "status" "SourcingRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityUnit" TEXT,
    "specifications" JSONB,
    "requiredByDate" TIMESTAMP(3),
    "deliveryCountry" TEXT NOT NULL,
    "deliveryRegion" TEXT,
    "deliveryCity" TEXT,
    "budgetAmount" DECIMAL(12,2),
    "budgetCurrency" TEXT,
    "unableToSourceReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "categoryId" TEXT,
    "assignedStaffId" TEXT,

    CONSTRAINT "custom_sourcing_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sourcing_request_attachment" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourcingRequestId" TEXT NOT NULL,

    CONSTRAINT "sourcing_request_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sourcing_option" (
    "id" TEXT NOT NULL,
    "sourceType" "SourcingOptionSourceType" NOT NULL,
    "vendorId" TEXT,
    "vendorListingId" TEXT,
    "externalSupplierName" TEXT,
    "externalSupplierContact" TEXT,
    "quantityAvailable" INTEGER,
    "proposedQuantity" INTEGER NOT NULL,
    "unitSupplyCost" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "leadTimeDays" INTEGER,
    "originCountry" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourcingRequestId" TEXT NOT NULL,

    CONSTRAINT "sourcing_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sourcing_allocation" (
    "id" TEXT NOT NULL,
    "allocatedQuantity" INTEGER NOT NULL,
    "unitSupplyCostSnapshot" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "leadTimeDaysSnapshot" INTEGER,
    "originCountrySnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourcingRequestId" TEXT NOT NULL,
    "sourcingOptionId" TEXT NOT NULL,

    CONSTRAINT "sourcing_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sourcing_request_activity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourcingRequestId" TEXT NOT NULL,

    CONSTRAINT "sourcing_request_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_sourcing_request_requestNumber_key" ON "custom_sourcing_request"("requestNumber");

-- CreateIndex
CREATE INDEX "custom_sourcing_request_customerProfileId_createdAt_idx" ON "custom_sourcing_request"("customerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "custom_sourcing_request_status_createdAt_idx" ON "custom_sourcing_request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "custom_sourcing_request_assignedStaffId_status_idx" ON "custom_sourcing_request"("assignedStaffId", "status");

-- CreateIndex
CREATE INDEX "sourcing_request_attachment_sourcingRequestId_idx" ON "sourcing_request_attachment"("sourcingRequestId");

-- CreateIndex
CREATE INDEX "sourcing_option_sourcingRequestId_idx" ON "sourcing_option"("sourcingRequestId");

-- CreateIndex
CREATE INDEX "sourcing_allocation_sourcingRequestId_idx" ON "sourcing_allocation"("sourcingRequestId");

-- CreateIndex
CREATE INDEX "sourcing_allocation_sourcingOptionId_idx" ON "sourcing_allocation"("sourcingOptionId");

-- CreateIndex
CREATE INDEX "sourcing_request_activity_sourcingRequestId_createdAt_idx" ON "sourcing_request_activity"("sourcingRequestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_supersedesQuotationId_key" ON "quotation"("supersedesQuotationId");

-- CreateIndex
CREATE INDEX "quotation_sourcingRequestId_idx" ON "quotation"("sourcingRequestId");

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "custom_sourcing_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_supersedesQuotationId_fkey" FOREIGN KEY ("supersedesQuotationId") REFERENCES "quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_contextSourcingRequestId_fkey" FOREIGN KEY ("contextSourcingRequestId") REFERENCES "custom_sourcing_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_sourcing_request" ADD CONSTRAINT "custom_sourcing_request_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_sourcing_request" ADD CONSTRAINT "custom_sourcing_request_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_sourcing_request" ADD CONSTRAINT "custom_sourcing_request_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_request_attachment" ADD CONSTRAINT "sourcing_request_attachment_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "custom_sourcing_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_option" ADD CONSTRAINT "sourcing_option_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_option" ADD CONSTRAINT "sourcing_option_vendorListingId_fkey" FOREIGN KEY ("vendorListingId") REFERENCES "vendor_listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_option" ADD CONSTRAINT "sourcing_option_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "custom_sourcing_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_allocation" ADD CONSTRAINT "sourcing_allocation_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "custom_sourcing_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_allocation" ADD CONSTRAINT "sourcing_allocation_sourcingOptionId_fkey" FOREIGN KEY ("sourcingOptionId") REFERENCES "sourcing_option"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sourcing_request_activity" ADD CONSTRAINT "sourcing_request_activity_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "custom_sourcing_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

