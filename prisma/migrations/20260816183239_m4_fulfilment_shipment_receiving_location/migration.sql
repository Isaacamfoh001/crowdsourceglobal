/*
  Warnings:

  - Added the required column `origin` to the `fulfilment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FulfilmentOrigin" AS ENUM ('DOMESTIC_COLLECTION', 'INTERNATIONAL_INBOUND');

-- CreateEnum
CREATE TYPE "FulfilmentIssueStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'COLLECTED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'EXCEPTION');

-- AlterTable
ALTER TABLE "fulfilment" ADD COLUMN     "origin" "FulfilmentOrigin" NOT NULL;

-- AlterTable
ALTER TABLE "vendor" ADD COLUMN     "pickupAddressLine1" TEXT,
ADD COLUMN     "pickupContactName" TEXT,
ADD COLUMN     "pickupContactPhone" TEXT,
ADD COLUMN     "pickupHours" TEXT,
ADD COLUMN     "pickupNotes" TEXT;

-- CreateTable
CREATE TABLE "fulfilment_issue" (
    "id" TEXT NOT NULL,
    "status" "FulfilmentIssueStatus" NOT NULL DEFAULT 'OPEN',
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNotes" TEXT,
    "fulfilmentId" TEXT NOT NULL,

    CONSTRAINT "fulfilment_issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "addressLine1" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receiving_location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment" (
    "id" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "carrier" TEXT,
    "trackingReference" TEXT,
    "collectionScheduledAt" TIMESTAMP(3),
    "collectionNotes" TEXT,
    "collectedAt" TIMESTAMP(3),
    "collectedByUserId" TEXT,
    "receivingLocationId" TEXT,
    "shippedAt" TIMESTAMP(3),
    "expectedArrivalAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "outForDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "deliveryFailedAt" TIMESTAMP(3),
    "deliveryNotes" TEXT,
    "customerConfirmedReceiptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fulfilmentId" TEXT NOT NULL,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fulfilment_issue_fulfilmentId_idx" ON "fulfilment_issue"("fulfilmentId");

-- CreateIndex
CREATE INDEX "fulfilment_issue_status_idx" ON "fulfilment_issue"("status");

-- CreateIndex
CREATE INDEX "receiving_location_active_idx" ON "receiving_location"("active");

-- CreateIndex
CREATE INDEX "shipment_fulfilmentId_idx" ON "shipment"("fulfilmentId");

-- CreateIndex
CREATE INDEX "shipment_status_idx" ON "shipment"("status");

-- CreateIndex
CREATE INDEX "shipment_trackingReference_idx" ON "shipment"("trackingReference");

-- CreateIndex
CREATE INDEX "fulfilment_vendorId_status_idx" ON "fulfilment"("vendorId", "status");

-- AddForeignKey
ALTER TABLE "fulfilment_issue" ADD CONSTRAINT "fulfilment_issue_fulfilmentId_fkey" FOREIGN KEY ("fulfilmentId") REFERENCES "fulfilment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_receivingLocationId_fkey" FOREIGN KEY ("receivingLocationId") REFERENCES "receiving_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_fulfilmentId_fkey" FOREIGN KEY ("fulfilmentId") REFERENCES "fulfilment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
