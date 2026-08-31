import { prisma } from "../../lib/db";
import { paginationSkip } from "../../lib/pagination";
import type { Prisma } from "../../generated/prisma/client";
import type {
  AdminTalentListFilter,
  TalentApplicationStatus,
  TalentCloseOutcome,
  TalentOpportunityType,
  TalentSkill,
  TalentWorkStatus,
  TalentExperienceLevel,
  TalentAvailability,
} from "./types";

type CreateApplicationData = {
  fullName: string;
  phone: string;
  email: string | null;
  city: string;
  region: string | null;
  currentWorkStatus: TalentWorkStatus;
  experienceLevel: TalentExperienceLevel;
  availability: TalentAvailability;
  opportunityTypes: TalentOpportunityType[];
  willingToRelocate: boolean;
  preferredWorkLocation: string | null;
  otherSkillDescription: string | null;
  statement: string | null;
  portfolioUrl: string | null;
  portfolioLinks: string[];
  ownershipConfirmed: boolean;
};

type WorkSampleData = { storageKey: string; mimeType: string; sizeBytes: number; caption: string | null };

const adminSummarySelect = {
  id: true,
  applicationNumber: true,
  fullName: true,
  city: true,
  region: true,
  experienceLevel: true,
  opportunityTypes: true,
  submittedAt: true,
  status: true,
  skills: { select: { skill: true } },
  _count: { select: { workSamples: true } },
} as const;

const adminDetailSelect = {
  id: true,
  applicationNumber: true,
  fullName: true,
  phone: true,
  email: true,
  city: true,
  region: true,
  currentWorkStatus: true,
  experienceLevel: true,
  availability: true,
  otherSkillDescription: true,
  opportunityTypes: true,
  willingToRelocate: true,
  preferredWorkLocation: true,
  statement: true,
  portfolioUrl: true,
  portfolioLinks: true,
  status: true,
  closeOutcome: true,
  statusUpdatedAt: true,
  statusUpdatedByAdmin: { select: { user: { select: { name: true } } } },
  submittedAt: true,
  skills: { select: { skill: true } },
  workSamples: {
    select: { id: true, caption: true, mimeType: true, createdAt: true },
    orderBy: { sortOrder: "asc" as const },
  },
  notes: {
    select: { id: true, note: true, createdAt: true, authorAdmin: { select: { user: { select: { name: true } } } } },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

export const talentRepository = {
  /** Upload happens before this call (service layer) — this is the one atomic DB write. */
  createApplicationTransactional(
    applicationNumber: string,
    data: CreateApplicationData,
    skills: TalentSkill[],
    workSamples: WorkSampleData[],
  ) {
    return prisma.$transaction(async (tx) => {
      const application = await tx.talentApplication.create({
        data: { applicationNumber, ...data },
        select: { id: true, applicationNumber: true },
      });
      await tx.talentApplicationSkill.createMany({
        data: skills.map((skill) => ({ applicationId: application.id, skill })),
      });
      await tx.talentWorkSample.createMany({
        data: workSamples.map((sample, index) => ({ ...sample, applicationId: application.id, sortOrder: index })),
      });
      return application;
    });
  },

  async findSummariesForAdmin(filter: AdminTalentListFilter, page: number, pageSize: number) {
    const where: Prisma.TalentApplicationWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.skill ? { skills: { some: { skill: filter.skill } } } : {}),
      ...(filter.search
        ? {
            OR: [
              { fullName: { contains: filter.search, mode: "insensitive" } },
              { phone: { contains: filter.search, mode: "insensitive" } },
              { email: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.talentApplication.findMany({
        where,
        select: adminSummarySelect,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.talentApplication.count({ where }),
    ]);

    return { rows, total };
  },

  findDetailForAdmin(id: string) {
    return prisma.talentApplication.findUnique({ where: { id }, select: adminDetailSelect });
  },

  findWorkSampleById(id: string) {
    return prisma.talentWorkSample.findUnique({ select: { storageKey: true, mimeType: true }, where: { id } });
  },

  async updateStatus(
    id: string,
    status: TalentApplicationStatus,
    adminId: string,
    closeOutcome?: TalentCloseOutcome,
  ) {
    await prisma.talentApplication.update({
      where: { id },
      data: {
        status,
        closeOutcome: status === "CLOSED" ? (closeOutcome ?? null) : null,
        statusUpdatedAt: new Date(),
        statusUpdatedByAdminId: adminId,
      },
    });
  },

  findStatusForUpdate(id: string) {
    return prisma.talentApplication.findUnique({ where: { id }, select: { status: true } });
  },

  createNote(applicationId: string, authorAdminId: string, note: string) {
    return prisma.talentApplicationNote.create({ data: { applicationId, authorAdminId, note } });
  },
};
