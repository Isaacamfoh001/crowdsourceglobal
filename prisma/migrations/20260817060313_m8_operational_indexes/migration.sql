
-- CreateIndex
CREATE INDEX "fulfilment_status_updatedAt_idx" ON "fulfilment"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "order_status_createdAt_idx" ON "order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "quotation_status_expiresAt_idx" ON "quotation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "vendor_application_status_submittedAt_idx" ON "vendor_application"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "vendor_listing_approvalStatus_submittedAt_idx" ON "vendor_listing"("approvalStatus", "submittedAt");

