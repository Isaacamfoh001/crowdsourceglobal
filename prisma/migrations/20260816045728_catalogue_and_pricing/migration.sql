-- CreateEnum
CREATE TYPE "VendorVerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ListingApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'MADE_TO_ORDER');

-- CreateEnum
CREATE TYPE "MarginRuleType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentCategoryId" TEXT,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "description" TEXT,
    "verificationStatus" "VendorVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "storefrontSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_listing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" JSONB NOT NULL DEFAULT '[]',
    "specs" JSONB,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "moq" INTEGER NOT NULL DEFAULT 1,
    "maxOq" INTEGER,
    "leadTimeDays" INTEGER,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "availabilityStatus" "AvailabilityStatus" NOT NULL DEFAULT 'IN_STOCK',
    "approvalStatus" "ListingApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "listingStatus" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "vendor_listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_price_tier" (
    "id" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "listingId" TEXT NOT NULL,

    CONSTRAINT "bulk_price_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_cost_rule" (
    "id" TEXT NOT NULL,
    "vendorSupplyCost" DECIMAL(12,2) NOT NULL,
    "marginRuleType" "MarginRuleType" NOT NULL,
    "marginValue" DECIMAL(8,4) NOT NULL,
    "listingId" TEXT NOT NULL,

    CONSTRAINT "vendor_cost_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "category_parentCategoryId_idx" ON "category"("parentCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_storefrontSlug_key" ON "vendor"("storefrontSlug");

-- CreateIndex
CREATE INDEX "vendor_listing_vendorId_idx" ON "vendor_listing"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_listing_categoryId_idx" ON "vendor_listing"("categoryId");

-- CreateIndex
CREATE INDEX "vendor_listing_approvalStatus_listingStatus_idx" ON "vendor_listing"("approvalStatus", "listingStatus");

-- CreateIndex
CREATE INDEX "bulk_price_tier_listingId_idx" ON "bulk_price_tier"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_price_tier_listingId_minQuantity_key" ON "bulk_price_tier"("listingId", "minQuantity");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_cost_rule_listingId_key" ON "vendor_cost_rule"("listingId");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_listing" ADD CONSTRAINT "vendor_listing_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_listing" ADD CONSTRAINT "vendor_listing_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_price_tier" ADD CONSTRAINT "bulk_price_tier_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "vendor_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_cost_rule" ADD CONSTRAINT "vendor_cost_rule_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "vendor_listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
