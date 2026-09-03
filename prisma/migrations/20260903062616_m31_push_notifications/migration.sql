-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "push_device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_delivery_job" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_delivery_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_device_expoPushToken_key" ON "push_device"("expoPushToken");

-- CreateIndex
CREATE INDEX "push_device_userId_idx" ON "push_device"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_delivery_job_notificationId_key" ON "push_delivery_job"("notificationId");

-- CreateIndex
CREATE INDEX "push_delivery_job_status_availableAt_idx" ON "push_delivery_job"("status", "availableAt");

-- AddForeignKey
ALTER TABLE "push_device" ADD CONSTRAINT "push_device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_delivery_job" ADD CONSTRAINT "push_delivery_job_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
