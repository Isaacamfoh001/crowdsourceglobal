-- CreateEnum
CREATE TYPE "TalentApplicationStatus" AS ENUM ('NEW', 'REVIEWING', 'SHORTLISTED', 'REFERRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TalentCloseOutcome" AS ENUM ('PLACED', 'NOT_SELECTED', 'WITHDRAWN', 'OTHER');

-- CreateEnum
CREATE TYPE "TalentSkill" AS ENUM ('HAIRDRESSING', 'WIG_MAKING', 'WIG_INSTALLATION', 'BRAIDING', 'HAIR_COLOURING_TREATMENT', 'MAKEUP_ARTISTRY', 'LASH_EXTENSIONS', 'BROWS', 'MANICURE_PEDICURE', 'NAIL_TECHNOLOGY', 'BARBERING', 'SKINCARE_BEAUTY_THERAPY', 'SALON_ASSISTANT', 'BEAUTY_RETAIL_SALES', 'OTHER');

-- CreateEnum
CREATE TYPE "TalentExperienceLevel" AS ENUM ('JUST_STARTING', 'UNDER_1_YEAR', 'ONE_TO_TWO_YEARS', 'THREE_TO_FIVE_YEARS', 'FIVE_PLUS_YEARS');

-- CreateEnum
CREATE TYPE "TalentAvailability" AS ENUM ('IMMEDIATELY', 'WITHIN_2_WEEKS', 'WITHIN_1_MONTH', 'JUST_EXPLORING');

-- CreateEnum
CREATE TYPE "TalentOpportunityType" AS ENUM ('FULL_TIME', 'PART_TIME', 'APPRENTICESHIP', 'CONTRACT_FREELANCE', 'OPEN_TO_ANY');

-- CreateEnum
CREATE TYPE "TalentWorkStatus" AS ENUM ('NOT_WORKING', 'FULL_TIME_EMPLOYED', 'PART_TIME_EMPLOYED', 'FREELANCE_SELF_EMPLOYED', 'APPRENTICE_TRAINEE', 'OTHER');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_NEW_TALENT_APPLICATION';

-- CreateTable
CREATE TABLE "talent_application" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "currentWorkStatus" "TalentWorkStatus" NOT NULL,
    "experienceLevel" "TalentExperienceLevel" NOT NULL,
    "availability" "TalentAvailability" NOT NULL,
    "opportunityTypes" "TalentOpportunityType"[],
    "willingToRelocate" BOOLEAN NOT NULL DEFAULT false,
    "preferredWorkLocation" TEXT,
    "otherSkillDescription" TEXT,
    "statement" TEXT NOT NULL,
    "portfolioUrl" TEXT,
    "ownershipConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "TalentApplicationStatus" NOT NULL DEFAULT 'NEW',
    "closeOutcome" "TalentCloseOutcome",
    "statusUpdatedAt" TIMESTAMP(3),
    "statusUpdatedByAdminId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_application_skill" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "skill" "TalentSkill" NOT NULL,

    CONSTRAINT "talent_application_skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_work_sample" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_work_sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_application_note" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorAdminId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_application_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "talent_application_applicationNumber_key" ON "talent_application"("applicationNumber");

-- CreateIndex
CREATE INDEX "talent_application_status_submittedAt_idx" ON "talent_application"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "talent_application_submittedAt_idx" ON "talent_application"("submittedAt");

-- CreateIndex
CREATE INDEX "talent_application_skill_skill_idx" ON "talent_application_skill"("skill");

-- CreateIndex
CREATE UNIQUE INDEX "talent_application_skill_applicationId_skill_key" ON "talent_application_skill"("applicationId", "skill");

-- CreateIndex
CREATE INDEX "talent_work_sample_applicationId_sortOrder_idx" ON "talent_work_sample"("applicationId", "sortOrder");

-- CreateIndex
CREATE INDEX "talent_application_note_applicationId_createdAt_idx" ON "talent_application_note"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "talent_application" ADD CONSTRAINT "talent_application_statusUpdatedByAdminId_fkey" FOREIGN KEY ("statusUpdatedByAdminId") REFERENCES "admin_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_application_skill" ADD CONSTRAINT "talent_application_skill_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "talent_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_work_sample" ADD CONSTRAINT "talent_work_sample_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "talent_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_application_note" ADD CONSTRAINT "talent_application_note_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "talent_application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_application_note" ADD CONSTRAINT "talent_application_note_authorAdminId_fkey" FOREIGN KEY ("authorAdminId") REFERENCES "admin_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
