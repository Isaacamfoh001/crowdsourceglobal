-- CreateEnum
CREATE TYPE "QuotationOrigin" AS ENUM ('INSTANT');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('ISSUED', 'ACCEPTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "originQuotationId" TEXT;

-- CreateTable
CREATE TABLE "quotation" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "origin" "QuotationOrigin" NOT NULL DEFAULT 'INSTANT',
    "status" "QuotationStatus" NOT NULL DEFAULT 'ISSUED',
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerProfileId" TEXT NOT NULL,

    CONSTRAINT "quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_item" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "vendorPayableBasis" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotationId" TEXT NOT NULL,
    "listingId" TEXT,
    "vendorId" TEXT,

    CONSTRAINT "quotation_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_reference_key" ON "quotation"("reference");

-- CreateIndex
CREATE INDEX "quotation_customerProfileId_idx" ON "quotation"("customerProfileId");

-- CreateIndex
CREATE INDEX "quotation_status_idx" ON "quotation"("status");

-- CreateIndex
CREATE INDEX "quotation_item_quotationId_idx" ON "quotation_item"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "order_originQuotationId_key" ON "order"("originQuotationId");

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_item" ADD CONSTRAINT "quotation_item_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_item" ADD CONSTRAINT "quotation_item_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "vendor_listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_item" ADD CONSTRAINT "quotation_item_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_originQuotationId_fkey" FOREIGN KEY ("originQuotationId") REFERENCES "quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

