-- CreateEnum
CREATE TYPE "BeautyProfessionalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ServiceLocationMode" AS ENUM ('PROVIDER_LOCATION', 'CUSTOMER_LOCATION', 'BOTH');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('SUBMITTED', 'PROVIDER_ACCEPTED', 'PROVIDER_DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "beauty_professional_profile" (
    "id" TEXT NOT NULL,
    "status" "BeautyProfessionalStatus" NOT NULL DEFAULT 'DRAFT',
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "heroImageUrl" TEXT,
    "specialtyCategorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locationMode" "ServiceLocationMode" NOT NULL DEFAULT 'PROVIDER_LOCATION',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "changesRequestedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "beauty_professional_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beauty_service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startingPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "professionalId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "beauty_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request" (
    "id" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "preferredDate" TIMESTAMP(3) NOT NULL,
    "preferredTimeNote" TEXT,
    "locationMode" "ServiceLocationMode" NOT NULL,
    "locationDetails" TEXT,
    "notes" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "referenceImage" TEXT,
    "declineReason" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "service_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "beauty_professional_profile_vendorId_key" ON "beauty_professional_profile"("vendorId");

-- CreateIndex
CREATE INDEX "beauty_professional_profile_status_idx" ON "beauty_professional_profile"("status");

-- CreateIndex
CREATE INDEX "beauty_professional_profile_status_submittedAt_idx" ON "beauty_professional_profile"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "beauty_service_professionalId_idx" ON "beauty_service"("professionalId");

-- CreateIndex
CREATE INDEX "beauty_service_categoryId_idx" ON "beauty_service"("categoryId");

-- CreateIndex
CREATE INDEX "service_request_customerUserId_idx" ON "service_request"("customerUserId");

-- CreateIndex
CREATE INDEX "service_request_professionalId_idx" ON "service_request"("professionalId");

-- CreateIndex
CREATE INDEX "service_request_professionalId_createdAt_idx" ON "service_request"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "service_request_status_createdAt_idx" ON "service_request"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "beauty_professional_profile" ADD CONSTRAINT "beauty_professional_profile_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beauty_service" ADD CONSTRAINT "beauty_service_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "beauty_professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beauty_service" ADD CONSTRAINT "beauty_service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "beauty_professional_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "beauty_service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
