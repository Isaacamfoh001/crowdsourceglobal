-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('VENDOR_APPLICATION_SUBMITTED', 'VENDOR_APPLICATION_APPROVED', 'VENDOR_APPLICATION_CHANGES_REQUESTED', 'VENDOR_APPLICATION_REJECTED', 'LISTING_APPROVED', 'LISTING_CHANGES_REQUESTED', 'LISTING_REJECTED', 'ORDER_CONFIRMED', 'VENDOR_NEW_ORDER', 'COLLECTION_SCHEDULED', 'PACKAGE_COLLECTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FULFILMENT_ISSUE_RESOLVED', 'QUOTE_ISSUED', 'SOURCING_REQUEST_SUBMITTED', 'SOURCING_CLARIFICATION_NEEDED', 'SOURCING_QUOTE_READY', 'SOURCING_UNABLE_TO_SOURCE', 'STAFF_REPLY', 'VENDOR_STAFF_REPLY', 'ADMIN_NEW_VENDOR_APPLICATION', 'ADMIN_NEW_SOURCING_REQUEST', 'ADMIN_NEW_MESSAGE');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_delivery_job" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateData" JSONB NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_delivery_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ordersDeliveryEmail" BOOLEAN NOT NULL DEFAULT true,
    "quotationsSourcingEmail" BOOLEAN NOT NULL DEFAULT true,
    "messagesEmail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_recipientUserId_createdAt_idx" ON "notification"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_recipientUserId_readAt_idx" ON "notification"("recipientUserId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipientUserId_eventKey_key" ON "notification"("recipientUserId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "email_delivery_job_notificationId_key" ON "email_delivery_job"("notificationId");

-- CreateIndex
CREATE INDEX "email_delivery_job_status_availableAt_idx" ON "email_delivery_job"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_userId_key" ON "notification_preference"("userId");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_delivery_job" ADD CONSTRAINT "email_delivery_job_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

