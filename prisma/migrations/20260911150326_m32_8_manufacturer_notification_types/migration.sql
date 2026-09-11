-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'MANUFACTURER_APPLICATION_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'MANUFACTURER_APPLICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'MANUFACTURER_APPLICATION_CHANGES_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'MANUFACTURER_APPLICATION_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_NEW_MANUFACTURER_APPLICATION';
