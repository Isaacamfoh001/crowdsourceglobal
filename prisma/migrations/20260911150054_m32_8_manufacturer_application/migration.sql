-- CreateTable
CREATE TABLE "manufacturer_application" (
    "id" TEXT NOT NULL,
    "status" "VendorApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "categorySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categoryOther" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerUserId" TEXT,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "manufacturer_application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturer_application_vendorId_key" ON "manufacturer_application"("vendorId");

-- CreateIndex
CREATE INDEX "manufacturer_application_status_idx" ON "manufacturer_application"("status");

-- CreateIndex
CREATE INDEX "manufacturer_application_status_submittedAt_idx" ON "manufacturer_application"("status", "submittedAt");

-- AddForeignKey
ALTER TABLE "manufacturer_application" ADD CONSTRAINT "manufacturer_application_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
