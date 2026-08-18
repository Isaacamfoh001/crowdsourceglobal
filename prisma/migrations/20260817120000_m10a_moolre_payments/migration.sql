-- CreateEnum
CREATE TYPE "PaymentProviderName" AS ENUM ('MOCK', 'MOOLRE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MOCK', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "PaymentNetwork" AS ENUM ('MTN', 'TELECEL', 'AT');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'CANCELLED';

-- AlterTable: add new columns first (nullable/defaulted so existing rows are valid)
ALTER TABLE "payment" ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "exceptionReason" TEXT,
ADD COLUMN     "failureReasonSafe" TEXT,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "network" "PaymentNetwork",
ADD COLUMN     "phoneMasked" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "providerNew" "PaymentProviderName",
ADD COLUMN     "methodNew" "PaymentMethod";

-- Backfill: preserve existing mock Payment records rather than silently dropping their data.
UPDATE "payment" SET
  "providerNew" = CASE WHEN lower("provider") = 'mock' THEN 'MOCK'::"PaymentProviderName" ELSE 'MOCK'::"PaymentProviderName" END,
  "methodNew" = CASE WHEN lower("method") = 'mock' THEN 'MOCK'::"PaymentMethod" ELSE 'MOCK'::"PaymentMethod" END,
  "reference" = 'PAY-LEGACY-' || substr(md5(id), 1, 10);

-- Drop the old string columns and promote the new enum columns in their place.
ALTER TABLE "payment" DROP COLUMN "provider";
ALTER TABLE "payment" DROP COLUMN "method";
ALTER TABLE "payment" RENAME COLUMN "providerNew" TO "provider";
ALTER TABLE "payment" RENAME COLUMN "methodNew" TO "method";

ALTER TABLE "payment" ALTER COLUMN "provider" SET NOT NULL;
ALTER TABLE "payment" ALTER COLUMN "provider" SET DEFAULT 'MOCK';
ALTER TABLE "payment" ALTER COLUMN "method" SET NOT NULL;
ALTER TABLE "payment" ALTER COLUMN "method" SET DEFAULT 'MOCK';
ALTER TABLE "payment" ALTER COLUMN "reference" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payment_reference_key" ON "payment"("reference");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payment"("status");

-- CreateIndex
CREATE INDEX "payment_exceptionReason_idx" ON "payment"("exceptionReason");
