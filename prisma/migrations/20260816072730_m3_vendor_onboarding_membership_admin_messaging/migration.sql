-- CreateEnum
CREATE TYPE "SellerType" AS ENUM ('INDIVIDUAL', 'SOLE_TRADER', 'REGISTERED_BUSINESS', 'DISTRIBUTOR_WHOLESALER', 'MANUFACTURER', 'ORGANIZATION', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VendorMembershipRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPS_ADMIN', 'FINANCE_ADMIN');

-- CreateEnum
CREATE TYPE "ConversationParticipantType" AS ENUM ('CUSTOMER', 'VENDOR');

-- CreateEnum
CREATE TYPE "ConversationContextType" AS ENUM ('LISTING', 'VENDOR', 'ORDER', 'GENERAL');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "vendor" ADD COLUMN     "categorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "leadTimeDaysDefault" INTEGER,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "sellerType" "SellerType";

-- AlterTable
ALTER TABLE "vendor_listing" ADD COLUMN     "changesRequestedReason" TEXT,
ADD COLUMN     "pendingChanges" JSONB,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "vendor_application" (
    "id" TEXT NOT NULL,
    "status" "VendorApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "sellerType" "SellerType",
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "displayName" TEXT,
    "legalName" TEXT,
    "storeDescription" TEXT,
    "registrationNumber" TEXT,
    "taxIdentifier" TEXT,
    "yearEstablished" INTEGER,
    "websiteUrl" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "addressLine1" TEXT,
    "categorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sellingMode" TEXT,
    "bulkCapable" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDaysDefault" INTEGER,
    "serviceAreas" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerUserId" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "vendorId" TEXT,

    CONSTRAINT "vendor_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_membership" (
    "id" TEXT NOT NULL,
    "role" "VendorMembershipRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "vendor_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_user" (
    "id" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "admin_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "participantType" "ConversationParticipantType" NOT NULL,
    "contextType" "ConversationContextType" NOT NULL DEFAULT 'GENERAL',
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerProfileId" TEXT,
    "vendorId" TEXT,
    "contextListingId" TEXT,
    "contextVendorId" TEXT,
    "contextOrderId" TEXT,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "senderIsStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_application_applicantUserId_key" ON "vendor_application"("applicantUserId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_application_vendorId_key" ON "vendor_application"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_application_status_idx" ON "vendor_application"("status");

-- CreateIndex
CREATE INDEX "vendor_membership_vendorId_idx" ON "vendor_membership"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_membership_userId_vendorId_key" ON "vendor_membership"("userId", "vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_userId_key" ON "admin_user"("userId");

-- CreateIndex
CREATE INDEX "conversation_customerProfileId_idx" ON "conversation"("customerProfileId");

-- CreateIndex
CREATE INDEX "conversation_vendorId_idx" ON "conversation"("vendorId");

-- CreateIndex
CREATE INDEX "message_conversationId_idx" ON "message"("conversationId");

-- AddForeignKey
ALTER TABLE "vendor_application" ADD CONSTRAINT "vendor_application_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_application" ADD CONSTRAINT "vendor_application_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_membership" ADD CONSTRAINT "vendor_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_membership" ADD CONSTRAINT "vendor_membership_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "customer_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_contextListingId_fkey" FOREIGN KEY ("contextListingId") REFERENCES "vendor_listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_contextVendorId_fkey" FOREIGN KEY ("contextVendorId") REFERENCES "vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_contextOrderId_fkey" FOREIGN KEY ("contextOrderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
