import { generateTalentApplicationNumber } from "../../lib/talent-number";
import { storageProvider, generateStorageKey } from "../../lib/storage";
import { validateWorkSampleImage, MIN_WORK_SAMPLES, MAX_WORK_SAMPLES, WORK_SAMPLE_EXTENSION_BY_MIME_TYPE } from "./image-validation";
import { ok, err, type Result } from "../../lib/result";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { administrationRepository } from "../administration/repository";
import { talentRepository } from "./repository";
import type {
  AdminTalentApplicationDetailView,
  AdminTalentApplicationSummaryView,
  AdminTalentListFilter,
  TalentApplicationInput,
  TalentApplicationStatus,
  TalentAvailability,
  TalentCloseOutcome,
  TalentExperienceLevel,
  TalentOpportunityType,
  TalentSkill,
  TalentWorkSampleInput,
  TalentWorkStatus,
} from "./types";

const STATEMENT_MAX_LENGTH = 750;
const MAX_PORTFOLIO_LINKS = 3;

export const TALENT_STATUS_LABELS: Record<TalentApplicationStatus, string> = {
  NEW: "New",
  REVIEWING: "Reviewing",
  SHORTLISTED: "Shortlisted",
  REFERRED: "Referred",
  CLOSED: "Closed",
};

export const TALENT_SKILL_LABELS: Record<TalentSkill, string> = {
  HAIRDRESSING: "Hairdressing",
  WIG_MAKING: "Wig Making",
  WIG_INSTALLATION: "Wig Installation",
  BRAIDING: "Braiding",
  HAIR_COLOURING_TREATMENT: "Hair Colouring / Treatment",
  MAKEUP_ARTISTRY: "Makeup Artistry",
  LASH_EXTENSIONS: "Lash Extensions",
  BROWS: "Brows",
  MANICURE_PEDICURE: "Manicure / Pedicure",
  NAIL_TECHNOLOGY: "Nail Technology",
  BARBERING: "Barbering",
  SKINCARE_BEAUTY_THERAPY: "Skincare / Beauty Therapy",
  SALON_ASSISTANT: "Salon Assistant",
  BEAUTY_RETAIL_SALES: "Beauty Retail / Sales",
  OTHER: "Other",
};

export const TALENT_EXPERIENCE_LABELS: Record<TalentExperienceLevel, string> = {
  JUST_STARTING: "Just starting",
  UNDER_1_YEAR: "Less than 1 year",
  ONE_TO_TWO_YEARS: "1–2 years",
  THREE_TO_FIVE_YEARS: "3–5 years",
  FIVE_PLUS_YEARS: "5+ years",
};

export const TALENT_AVAILABILITY_LABELS: Record<TalentAvailability, string> = {
  IMMEDIATELY: "Immediately",
  WITHIN_2_WEEKS: "Within 2 weeks",
  WITHIN_1_MONTH: "Within 1 month",
  JUST_EXPLORING: "Just exploring opportunities",
};

export const TALENT_OPPORTUNITY_LABELS: Record<TalentOpportunityType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  APPRENTICESHIP: "Internship / Apprenticeship",
  CONTRACT_FREELANCE: "Contract / Freelance",
  OPEN_TO_ANY: "Open to any",
};

export const TALENT_WORK_STATUS_LABELS: Record<TalentWorkStatus, string> = {
  NOT_WORKING: "Not currently working",
  FULL_TIME_EMPLOYED: "Currently working full-time",
  PART_TIME_EMPLOYED: "Currently working part-time",
  FREELANCE_SELF_EMPLOYED: "Freelancing / self-employed",
  APPRENTICE_TRAINEE: "Apprentice / trainee",
  OTHER: "Other",
};

export const TALENT_CLOSE_OUTCOME_LABELS: Record<TalentCloseOutcome, string> = {
  PLACED: "Placed",
  NOT_SELECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
  OTHER: "Other",
};

/** Sequential workflow only — mirrors the fulfilment/sourcing "one next valid action" philosophy. */
const ALLOWED_TRANSITIONS: Record<TalentApplicationStatus, TalentApplicationStatus[]> = {
  NEW: ["REVIEWING"],
  REVIEWING: ["SHORTLISTED", "CLOSED"],
  SHORTLISTED: ["REFERRED", "CLOSED"],
  REFERRED: ["CLOSED"],
  CLOSED: [],
};

function isValidPortfolioUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function notifyStaffOfNewApplication(applicationId: string, applicationNumber: string, fullName: string): Promise<void> {
  const admins = await administrationRepository.listAllForNotification();
  for (const admin of admins) {
    await notificationsService.notify({
      recipientUserId: admin.userId,
      type: "ADMIN_NEW_TALENT_APPLICATION",
      title: "New Beauty Talent application",
      body: `${fullName} applied (${applicationNumber}).`,
      targetUrl: notificationLinks.adminTalentApplication(applicationId),
      eventKey: `admin-new-talent-application:${applicationId}`,
    });
  }
}

function toAdminSummary(row: {
  id: string;
  applicationNumber: string;
  fullName: string;
  city: string;
  region: string | null;
  experienceLevel: TalentExperienceLevel;
  opportunityTypes: TalentOpportunityType[];
  submittedAt: Date;
  status: TalentApplicationStatus;
  skills: { skill: TalentSkill }[];
  _count: { workSamples: number };
}): AdminTalentApplicationSummaryView {
  return {
    id: row.id,
    applicationNumber: row.applicationNumber,
    fullName: row.fullName,
    city: row.city,
    region: row.region,
    skills: row.skills.map((s) => s.skill),
    experienceLevel: row.experienceLevel,
    opportunityTypes: row.opportunityTypes,
    workSampleCount: row._count.workSamples,
    submittedAt: row.submittedAt,
    status: row.status,
  };
}

export const talentService = {
  /**
   * Guest submission — no userId/session anywhere in this call. Uploads
   * happen before the one atomic DB transaction (same tradeoff as
   * sourcingService.submitRequest: a failure between "files uploaded" and
   * "transaction committed" can leave orphan objects, never a half-created
   * application row — acceptable and consistent with existing precedent
   * rather than building a draft/reservation system for M15).
   */
  async submitApplication(input: TalentApplicationInput, files: TalentWorkSampleInput[]): Promise<Result<{ id: string; applicationNumber: string }>> {
    if (!input.fullName.trim()) return err("Enter your full name.");
    if (!input.phone.trim()) return err("Enter a phone or WhatsApp number we can reach you on.");
    if (!input.city.trim()) return err("Enter your city or town.");
    if (!(input.currentWorkStatus in TALENT_WORK_STATUS_LABELS)) return err("Select your current work status.");
    if (!(input.experienceLevel in TALENT_EXPERIENCE_LABELS)) return err("Select your experience level.");
    if (!(input.availability in TALENT_AVAILABILITY_LABELS)) return err("Select your availability.");
    if (input.skills.length === 0) return err("Select at least one skill.");
    if (input.skills.some((skill) => !(skill in TALENT_SKILL_LABELS))) return err("Select a valid skill.");
    if (input.opportunityTypes.some((type) => !(type in TALENT_OPPORTUNITY_LABELS))) {
      return err("Select a valid opportunity type.");
    }
    if (input.skills.includes("OTHER") && !input.otherSkillDescription?.trim()) {
      return err("Tell us what your other skill is.");
    }
    if (input.opportunityTypes.length === 0) return err("Select at least one type of opportunity you're looking for.");
    const statement = input.statement?.trim() || null;
    if (statement && statement.length > STATEMENT_MAX_LENGTH) {
      return err(`Keep your statement under ${STATEMENT_MAX_LENGTH} characters.`);
    }
    if (input.portfolioUrl?.trim() && !isValidPortfolioUrl(input.portfolioUrl.trim())) {
      return err("Enter a valid portfolio/social link (starting with http:// or https://), or leave it blank.");
    }
    const portfolioLinks = (input.portfolioLinks ?? []).map((link) => link.trim()).filter(Boolean);
    if (portfolioLinks.length > MAX_PORTFOLIO_LINKS) {
      return err(`You can add up to ${MAX_PORTFOLIO_LINKS} work/portfolio links.`);
    }
    if (portfolioLinks.some((link) => !isValidPortfolioUrl(link))) {
      return err("Work/portfolio links must be valid URLs starting with http:// or https://.");
    }
    if (!input.ownershipConfirmed) {
      return err("Please confirm the work samples are your own before submitting.");
    }
    if (files.length < MIN_WORK_SAMPLES) {
      return err(`Upload at least ${MIN_WORK_SAMPLES} photos of your work.`);
    }
    if (files.length > MAX_WORK_SAMPLES) {
      return err(`You can upload up to ${MAX_WORK_SAMPLES} photos.`);
    }
    for (const file of files) {
      const validation = validateWorkSampleImage({ mimeType: file.mimeType, sizeBytes: file.buffer.length, buffer: file.buffer });
      if (!validation.ok) return err(validation.error);
    }

    const uploaded: { storageKey: string; mimeType: string; sizeBytes: number; caption: string | null }[] = [];
    try {
      for (const file of files) {
        const storageKey = generateStorageKey("talent-work-samples", WORK_SAMPLE_EXTENSION_BY_MIME_TYPE[file.mimeType] ?? "");
        await storageProvider.putObject({ key: storageKey, buffer: file.buffer, contentType: file.mimeType });
        uploaded.push({ storageKey, mimeType: file.mimeType, sizeBytes: file.buffer.length, caption: file.caption?.trim() || null });
      }
    } catch (error) {
      console.error("Talent work sample upload failed:", error);
      return err("Something went wrong uploading your photos. Please try again.");
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const applicationNumber = generateTalentApplicationNumber();
      try {
        const created = await talentRepository.createApplicationTransactional(
          applicationNumber,
          {
            fullName: input.fullName.trim(),
            phone: input.phone.trim(),
            email: input.email?.trim() || null,
            city: input.city.trim(),
            region: input.region?.trim() || null,
            currentWorkStatus: input.currentWorkStatus,
            experienceLevel: input.experienceLevel,
            availability: input.availability,
            opportunityTypes: input.opportunityTypes,
            willingToRelocate: input.willingToRelocate,
            preferredWorkLocation: input.preferredWorkLocation?.trim() || null,
            otherSkillDescription: input.otherSkillDescription?.trim() || null,
            statement,
            portfolioUrl: input.portfolioUrl?.trim() || null,
            portfolioLinks,
            ownershipConfirmed: input.ownershipConfirmed,
          },
          input.skills,
          uploaded,
        );

        await notifyStaffOfNewApplication(created.id, created.applicationNumber, input.fullName.trim());
        return ok({ id: created.id, applicationNumber: created.applicationNumber });
      } catch (error) {
        if (isUniqueConstraintViolation(error)) continue; // applicationNumber collision — retry with a new one
        console.error("Talent application creation failed:", error);
        return err("Something went wrong submitting your application. Please try again.");
      }
    }
    return err("Something went wrong submitting your application. Please try again.");
  },

  // --- Admin/staff ---------------------------------------------------------

  async listForAdminPaginated(filter: AdminTalentListFilter, page: number) {
    const { rows, total } = await talentRepository.findSummariesForAdmin(filter, page, DEFAULT_PAGE_SIZE);
    return { rows: rows.map(toAdminSummary), total, pageSize: DEFAULT_PAGE_SIZE };
  },

  async getForAdmin(id: string): Promise<AdminTalentApplicationDetailView | null> {
    const row = await talentRepository.findDetailForAdmin(id);
    if (!row) return null;
    return {
      id: row.id,
      applicationNumber: row.applicationNumber,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      city: row.city,
      region: row.region,
      currentWorkStatus: row.currentWorkStatus,
      experienceLevel: row.experienceLevel,
      availability: row.availability,
      skills: row.skills.map((s) => s.skill),
      otherSkillDescription: row.otherSkillDescription,
      opportunityTypes: row.opportunityTypes,
      willingToRelocate: row.willingToRelocate,
      preferredWorkLocation: row.preferredWorkLocation,
      statement: row.statement,
      portfolioUrl: row.portfolioUrl,
      // Legacy single-URL rows (pre-M23.2 web submissions) surface here too
      // so Admin sees every work/portfolio link regardless of which client
      // the application came from.
      portfolioLinks: row.portfolioLinks.length > 0 ? row.portfolioLinks : row.portfolioUrl ? [row.portfolioUrl] : [],
      status: row.status,
      closeOutcome: row.closeOutcome,
      statusUpdatedAt: row.statusUpdatedAt,
      statusUpdatedByName: row.statusUpdatedByAdmin?.user.name ?? null,
      submittedAt: row.submittedAt,
      workSamples: row.workSamples.map((s) => ({ id: s.id, caption: s.caption, mimeType: s.mimeType, createdAt: s.createdAt })),
      notes: row.notes.map((n) => ({ id: n.id, note: n.note, authorName: n.authorAdmin.user.name, createdAt: n.createdAt })),
    };
  },

  /** Returns the storage key for a work sample — caller (the API route) is responsible for verifying the requester is staff before calling this. */
  getWorkSampleForDownload(id: string) {
    return talentRepository.findWorkSampleById(id);
  },

  async transitionStatus(
    id: string,
    adminId: string,
    nextStatus: TalentApplicationStatus,
    closeOutcome?: TalentCloseOutcome,
  ): Promise<Result<null>> {
    const current = await talentRepository.findStatusForUpdate(id);
    if (!current) return err("Application not found.");
    if (!ALLOWED_TRANSITIONS[current.status].includes(nextStatus)) {
      return err("That status change isn't valid from the current status.");
    }
    await talentRepository.updateStatus(id, nextStatus, adminId, closeOutcome);
    return ok(null);
  },

  async addInternalNote(applicationId: string, authorAdminId: string, note: string): Promise<Result<null>> {
    if (!note.trim()) return err("Write a note before saving.");
    await talentRepository.createNote(applicationId, authorAdminId, note.trim());
    return ok(null);
  },
};

function isUniqueConstraintViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
