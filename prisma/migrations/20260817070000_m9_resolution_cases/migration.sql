-- CreateEnum
CREATE TYPE "ResolutionCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'AWAITING_CUSTOMER', 'AWAITING_VENDOR', 'RESOLUTION_APPROVED', 'RESOLUTION_IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ResolutionIssueType" AS ENUM ('CUSTOMER_CANCELLATION_REQUEST', 'VENDOR_CANNOT_FULFIL', 'ITEM_DAMAGED', 'WRONG_ITEM', 'MISSING_ITEM', 'MISSING_QUANTITY', 'ITEM_NOT_AS_DESCRIBED', 'PACKAGE_NOT_RECEIVED', 'DELIVERY_FAILURE', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestedResolution" AS ENUM ('CANCELLATION', 'REFUND', 'PARTIAL_REFUND', 'REPLACEMENT', 'REDELIVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "ResolutionDecision" AS ENUM ('NO_ACTION', 'FULL_REFUND', 'PARTIAL_REFUND', 'REPLACEMENT', 'RETURN_AND_REFUND', 'RETURN_AND_REPLACEMENT', 'REDELIVERY');

-- CreateEnum
CREATE TYPE "ResolutionResponsibility" AS ENUM ('VENDOR', 'CROWNSOURCE', 'LOGISTICS', 'CUSTOMER', 'EXTERNAL_SUPPLIER', 'SHARED_OTHER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('APPROVED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReturnInspectionOutcome" AS ENUM ('RESELLABLE', 'NOT_RESELLABLE');

-- AlterEnum
ALTER TYPE "ConversationContextType" ADD VALUE 'RESOLUTION_CASE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RESOLUTION_CASE_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'RESOLUTION_CLARIFICATION_NEEDED';
ALTER TYPE "NotificationType" ADD VALUE 'RESOLUTION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'RETURN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'REFUND_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'REFUND_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'REPLACEMENT_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'RESOLUTION_CASE_RESOLVED';
ALTER TYPE "NotificationType" ADD VALUE 'RESOLUTION_VENDOR_RESPONSE_NEEDED';
ALTER TYPE "NotificationType" ADD VALUE 'RESOLUTION_VENDOR_CASE_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_NEW_RESOLUTION_CASE';
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_REFUND_FAILED';

-- AlterTable
ALTER TABLE "conversation" ADD COLUMN     "contextResolutionCaseId" TEXT;

-- CreateTable
CREATE TABLE "resolution_case" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "status" "ResolutionCaseStatus" NOT NULL DEFAULT 'OPEN',
    "issueType" "ResolutionIssueType" NOT NULL,
    "requestedResolution" "RequestedResolution",
    "customerDescription" TEXT NOT NULL,
    "customerSafeDecisionReason" TEXT,
    "responsibility" "ResolutionResponsibility",
    "customerProfileId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fulfilmentId" TEXT,
    "assignedStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "resolution_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_case_item" (
    "id" TEXT NOT NULL,
    "resolutionCaseId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "fulfilmentItemId" TEXT,
    "quantityAffected" INTEGER NOT NULL,
    "issueType" "ResolutionIssueType" NOT NULL,
    "requestedResolution" "RequestedResolution",
    "approvedResolution" "ResolutionDecision",
    "approvedRefundAmount" DECIMAL(12,2),
    "replacementQuantity" INTEGER,
    "refundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolution_case_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_case_attachment" (
    "id" TEXT NOT NULL,
    "resolutionCaseId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resolution_case_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_case_activity" (
    "id" TEXT NOT NULL,
    "resolutionCaseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resolution_case_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund" (
    "id" TEXT NOT NULL,
    "resolutionCaseId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "itemsAmount" DECIMAL(12,2) NOT NULL,
    "deliveryFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "providerEventId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return" (
    "id" TEXT NOT NULL,
    "resolutionCaseId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'APPROVED',
    "method" TEXT,
    "trackingReference" TEXT,
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3),
    "inspectedAt" TIMESTAMP(3),
    "inspectionOutcome" "ReturnInspectionOutcome",
    "restockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replacement" (
    "id" TEXT NOT NULL,
    "resolutionCaseId" TEXT NOT NULL,
    "originalOrderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "replacementOrderItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resolution_case_caseNumber_key" ON "resolution_case"("caseNumber");

-- CreateIndex
CREATE INDEX "resolution_case_customerProfileId_createdAt_idx" ON "resolution_case"("customerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "resolution_case_status_createdAt_idx" ON "resolution_case"("status", "createdAt");

-- CreateIndex
CREATE INDEX "resolution_case_assignedStaffId_status_idx" ON "resolution_case"("assignedStaffId", "status");

-- CreateIndex
CREATE INDEX "resolution_case_orderId_idx" ON "resolution_case"("orderId");

-- CreateIndex
CREATE INDEX "resolution_case_item_resolutionCaseId_idx" ON "resolution_case_item"("resolutionCaseId");

-- CreateIndex
CREATE INDEX "resolution_case_item_orderItemId_idx" ON "resolution_case_item"("orderItemId");

-- CreateIndex
CREATE INDEX "resolution_case_attachment_resolutionCaseId_idx" ON "resolution_case_attachment"("resolutionCaseId");

-- CreateIndex
CREATE INDEX "resolution_case_activity_resolutionCaseId_createdAt_idx" ON "resolution_case_activity"("resolutionCaseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "refund_providerEventId_key" ON "refund"("providerEventId");

-- CreateIndex
CREATE INDEX "refund_status_createdAt_idx" ON "refund"("status", "createdAt");

-- CreateIndex
CREATE INDEX "refund_resolutionCaseId_idx" ON "refund"("resolutionCaseId");

-- CreateIndex
CREATE INDEX "return_status_createdAt_idx" ON "return"("status", "createdAt");

-- CreateIndex
CREATE INDEX "return_resolutionCaseId_idx" ON "return"("resolutionCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "replacement_replacementOrderItemId_key" ON "replacement"("replacementOrderItemId");

-- CreateIndex
CREATE INDEX "replacement_resolutionCaseId_idx" ON "replacement"("resolutionCaseId");

-- CreateIndex
CREATE INDEX "conversation_contextResolutionCaseId_idx" ON "conversation"("contextResolutionCaseId");

-- AddForeignKey
ALTER TABLE "resolution_case" ADD CONSTRAINT "resolution_case_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_case" ADD CONSTRAINT "resolution_case_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_case" ADD CONSTRAINT "resolution_case_fulfilmentId_fkey" FOREIGN KEY ("fulfilmentId") REFERENCES "fulfilment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_case" ADD CONSTRAINT "resolution_case_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_case_item" ADD CONSTRAINT "resolution_case_item_resolutionCaseId_fkey" FOREIGN KEY ("resolutionCaseId") REFERENCES "resolution_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_case_item" ADD CONSTRAINT "resolution_case_item_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_case_item" ADD CONSTRAINT "resolution_case_item_fulfilmentItemId_fkey" FOREIGN KEY ("fulfilmentItemId") REFERENCES "fulfilment_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_case_item" ADD CONSTRAINT "resolution_case_item_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_case_attachment" ADD CONSTRAINT "resolution_case_attachment_resolutionCaseId_fkey" FOREIGN KEY ("resolutionCaseId") REFERENCES "resolution_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_case_activity" ADD CONSTRAINT "resolution_case_activity_resolutionCaseId_fkey" FOREIGN KEY ("resolutionCaseId") REFERENCES "resolution_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_resolutionCaseId_fkey" FOREIGN KEY ("resolutionCaseId") REFERENCES "resolution_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund" ADD CONSTRAINT "refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return" ADD CONSTRAINT "return_resolutionCaseId_fkey" FOREIGN KEY ("resolutionCaseId") REFERENCES "resolution_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacement" ADD CONSTRAINT "replacement_resolutionCaseId_fkey" FOREIGN KEY ("resolutionCaseId") REFERENCES "resolution_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacement" ADD CONSTRAINT "replacement_originalOrderItemId_fkey" FOREIGN KEY ("originalOrderItemId") REFERENCES "order_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacement" ADD CONSTRAINT "replacement_replacementOrderItemId_fkey" FOREIGN KEY ("replacementOrderItemId") REFERENCES "order_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_contextResolutionCaseId_fkey" FOREIGN KEY ("contextResolutionCaseId") REFERENCES "resolution_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

