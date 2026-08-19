
-- AlterTable
ALTER TABLE "vendor_earning" ADD COLUMN     "heldForResolutionCaseId" TEXT;

-- AddForeignKey
ALTER TABLE "vendor_earning" ADD CONSTRAINT "vendor_earning_heldForResolutionCaseId_fkey" FOREIGN KEY ("heldForResolutionCaseId") REFERENCES "resolution_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

