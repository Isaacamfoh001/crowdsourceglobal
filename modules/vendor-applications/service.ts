import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { slugify } from "../../lib/slug";
import { ok, err, type Result } from "../../lib/result";
import { vendorApplicationsRepository } from "./repository";
import {
  EDITABLE_STATUSES,
  REGISTRATION_RELEVANT_SELLER_TYPES,
  type VendorApplicationView,
  type SellerTypeStepInput,
  type ContactStepInput,
  type BusinessStepInput,
  type OperationsStepInput,
  type AdminApplicationSummary,
} from "./types";

const REVIEWABLE_STATUSES = ["SUBMITTED", "UNDER_REVIEW"];

function validateForSubmission(app: VendorApplicationView): Result<null> {
  if (!app.sellerType) return err("Choose how you sell before submitting.");
  if (!app.contactName || !app.contactEmail || !app.contactPhone) {
    return err("Complete your contact details before submitting.");
  }
  if (!app.displayName || !app.storeDescription) {
    return err("Complete your business information before submitting.");
  }
  if (!app.country || !app.region || !app.city || !app.addressLine1) {
    return err("Complete your location before submitting.");
  }
  if (REGISTRATION_RELEVANT_SELLER_TYPES.includes(app.sellerType) && !app.registrationNumber) {
    return err("Add your business registration number before submitting.");
  }
  if (app.categorySlugs.length === 0 || !app.sellingMode) {
    return err("Tell us what you sell before submitting.");
  }
  return ok(null);
}

async function requireEditableDraft(userId: string): Promise<Result<VendorApplicationView>> {
  const application = await vendorApplicationsRepository.findByApplicantUserId(userId);
  if (!application) return err("Start your vendor application first.");
  if (!EDITABLE_STATUSES.includes(application.status)) {
    return err("This application can no longer be edited.");
  }
  return ok(application);
}

async function generateUniqueSlug(base: string, attempt = 0): Promise<string> {
  const root = slugify(base);
  const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
  const taken = await prisma.vendor.findUnique({ where: { storefrontSlug: candidate }, select: { id: true } });
  if (taken) {
    return generateUniqueSlug(base, attempt + 1);
  }
  return candidate;
}

export const vendorApplicationsService = {
  getForUser(userId: string): Promise<VendorApplicationView | null> {
    return vendorApplicationsRepository.findByApplicantUserId(userId);
  },

  /** Get-or-create — called when the applicant begins/resumes onboarding. */
  async getOrCreateForUser(userId: string): Promise<VendorApplicationView> {
    const existing = await vendorApplicationsRepository.findByApplicantUserId(userId);
    if (existing) return existing;
    return vendorApplicationsRepository.createDraft(userId);
  },

  async saveSellerType(userId: string, input: SellerTypeStepInput): Promise<Result<null>> {
    const draft = await requireEditableDraft(userId);
    if (!draft.ok) return draft;
    await vendorApplicationsRepository.updateForApplicant(userId, { sellerType: input.sellerType });
    return ok(null);
  },

  async saveContact(userId: string, input: ContactStepInput): Promise<Result<null>> {
    const draft = await requireEditableDraft(userId);
    if (!draft.ok) return draft;
    await vendorApplicationsRepository.updateForApplicant(userId, input);
    return ok(null);
  },

  async saveBusiness(userId: string, input: BusinessStepInput): Promise<Result<null>> {
    const draft = await requireEditableDraft(userId);
    if (!draft.ok) return draft;
    await vendorApplicationsRepository.updateForApplicant(userId, input);
    return ok(null);
  },

  async saveOperations(userId: string, input: OperationsStepInput): Promise<Result<null>> {
    const draft = await requireEditableDraft(userId);
    if (!draft.ok) return draft;
    await vendorApplicationsRepository.updateForApplicant(userId, input);
    return ok(null);
  },

  async submit(userId: string): Promise<Result<null>> {
    const draft = await requireEditableDraft(userId);
    if (!draft.ok) return draft;

    const validation = validateForSubmission(draft.value);
    if (!validation.ok) return validation;

    await vendorApplicationsRepository.updateForApplicant(userId, {
      status: "SUBMITTED",
      submittedAt: new Date(),
      decisionReason: null,
    });
    return ok(null);
  },

  // --- Admin moderation -----------------------------------------------

  listForAdmin(statuses: string[] = REVIEWABLE_STATUSES): Promise<AdminApplicationSummary[]> {
    return vendorApplicationsRepository.listForAdmin(statuses);
  },

  getForAdmin(applicationId: string) {
    return vendorApplicationsRepository.findById(applicationId);
  },

  async beginReview(applicationId: string): Promise<Result<null>> {
    const application = await vendorApplicationsRepository.findById(applicationId);
    if (!application) return err("Application not found.");
    if (application.status !== "SUBMITTED") return ok(null); // already under review or beyond — no-op
    await prisma.vendorApplication.update({
      where: { id: applicationId },
      data: { status: "UNDER_REVIEW" },
    });
    return ok(null);
  },

  async approve(adminUserId: string, applicationId: string): Promise<Result<{ vendorId: string }>> {
    const application = await vendorApplicationsRepository.findById(applicationId);
    if (!application) return err("Application not found.");
    if (application.applicantUserId === adminUserId) {
      return err("You cannot approve your own vendor application.");
    }
    if (!REVIEWABLE_STATUSES.includes(application.status)) {
      return err("This application is not awaiting review.");
    }

    const validation = validateForSubmission(application);
    if (!validation.ok) return validation;

    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await generateUniqueSlug(application.displayName!);
      try {
        const vendor = await prisma.$transaction(async (tx) => {
          const vendor = await tx.vendor.create({
            data: {
              companyName: application.displayName!,
              description: application.storeDescription,
              verificationStatus: "APPROVED",
              storefrontSlug: slug,
              sellerType: application.sellerType,
              country: application.country,
              region: application.region,
              city: application.city,
              categorySlugs: application.categorySlugs,
              contactEmail: application.contactEmail,
              contactPhone: application.contactPhone,
              leadTimeDaysDefault: application.leadTimeDaysDefault,
            },
          });
          await tx.vendorMembership.create({
            data: { userId: application.applicantUserId, vendorId: vendor.id, role: "OWNER" },
          });
          await tx.vendorApplication.update({
            where: { id: application.id },
            data: {
              status: "APPROVED",
              vendorId: vendor.id,
              reviewedAt: new Date(),
              reviewerUserId: adminUserId,
              decisionReason: null,
            },
          });
          return vendor;
        });
        return ok({ vendorId: vendor.id });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue; // slug collision race — retry with the next candidate
        }
        console.error("Vendor application approval failed unexpectedly:", error);
        return err("Something went wrong approving this application. Please try again.");
      }
    }
    return err("Could not generate a unique store address. Please try again.");
  },

  async requestChanges(adminUserId: string, applicationId: string, reason: string): Promise<Result<null>> {
    const application = await vendorApplicationsRepository.findById(applicationId);
    if (!application) return err("Application not found.");
    if (application.applicantUserId === adminUserId) {
      return err("You cannot review your own vendor application.");
    }
    if (!REVIEWABLE_STATUSES.includes(application.status)) {
      return err("This application is not awaiting review.");
    }
    await prisma.vendorApplication.update({
      where: { id: applicationId },
      data: {
        status: "CHANGES_REQUESTED",
        decisionReason: reason,
        reviewedAt: new Date(),
        reviewerUserId: adminUserId,
      },
    });
    return ok(null);
  },

  async reject(adminUserId: string, applicationId: string, reason: string): Promise<Result<null>> {
    const application = await vendorApplicationsRepository.findById(applicationId);
    if (!application) return err("Application not found.");
    if (application.applicantUserId === adminUserId) {
      return err("You cannot review your own vendor application.");
    }
    if (!REVIEWABLE_STATUSES.includes(application.status)) {
      return err("This application is not awaiting review.");
    }
    await prisma.vendorApplication.update({
      where: { id: applicationId },
      data: {
        status: "REJECTED",
        decisionReason: reason,
        reviewedAt: new Date(),
        reviewerUserId: adminUserId,
      },
    });
    return ok(null);
  },
};
