
-- AlterEnum
ALTER TYPE "PaymentProviderName" ADD VALUE 'PAYSTACK';

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "providerReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payment_providerReference_key" ON "payment"("providerReference");

