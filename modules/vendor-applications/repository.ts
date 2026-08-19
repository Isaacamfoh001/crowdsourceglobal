import { prisma } from "../../lib/db";
import { paginationSkip } from "../../lib/pagination";
import type { VendorApplicationView, AdminApplicationSummary } from "./types";

const applicationSelect = {
  id: true,
  status: true,
  sellerType: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  displayName: true,
  legalName: true,
  storeDescription: true,
  registrationNumber: true,
  taxIdentifier: true,
  yearEstablished: true,
  websiteUrl: true,
  country: true,
  region: true,
  city: true,
  addressLine1: true,
  categorySlugs: true,
  sellingMode: true,
  bulkCapable: true,
  leadTimeDaysDefault: true,
  serviceAreas: true,
  submittedAt: true,
  reviewedAt: true,
  decisionReason: true,
  vendorId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const vendorApplicationsRepository = {
  findByApplicantUserId(userId: string): Promise<VendorApplicationView | null> {
    return prisma.vendorApplication.findUnique({
      where: { applicantUserId: userId },
      select: applicationSelect,
    });
  },

  createDraft(userId: string): Promise<VendorApplicationView> {
    return prisma.vendorApplication.create({
      data: { applicantUserId: userId },
      select: applicationSelect,
    });
  },

  /** Ownership-scoped update — only ever matches a row owned by `userId`. */
  async updateForApplicant(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<VendorApplicationView | null> {
    const result = await prisma.vendorApplication.updateMany({
      where: { applicantUserId: userId },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByApplicantUserId(userId);
  },

  findById(id: string) {
    return prisma.vendorApplication.findUnique({
      where: { id },
      select: {
        ...applicationSelect,
        applicantUserId: true,
        applicant: { select: { name: true, email: true } },
      },
    });
  },

  async listForAdmin(statuses: string[]): Promise<AdminApplicationSummary[]> {
    const rows = await prisma.vendorApplication.findMany({
      where: { status: { in: statuses as never[] } },
      select: {
        id: true,
        status: true,
        displayName: true,
        sellerType: true,
        submittedAt: true,
        createdAt: true,
        applicant: { select: { name: true, email: true } },
      },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      displayName: row.displayName,
      sellerType: row.sellerType,
      applicantName: row.applicant.name,
      applicantEmail: row.applicant.email,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
    }));
  },

  /**
   * (M11.1) Paginated variant of listForAdmin, for the admin vendor
   * applications queue page. listForAdmin itself stays unbounded — it's
   * also used by admin-dashboard for pending-application attention/summary
   * counts, which need the full matching set, not one page of it.
   */
  async listForAdminPaginated(statuses: string[], page: number, pageSize: number) {
    const where = { status: { in: statuses as never[] } };
    const [rows, total] = await Promise.all([
      prisma.vendorApplication.findMany({
        where,
        select: {
          id: true,
          status: true,
          displayName: true,
          sellerType: true,
          submittedAt: true,
          createdAt: true,
          applicant: { select: { name: true, email: true } },
        },
        // Oldest-first — deliberate queue order so staff review the
        // longest-waiting application first. Not a bug; do not flip to desc.
        orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.vendorApplication.count({ where }),
    ]);
    return {
      rows: rows.map((row) => ({
        id: row.id,
        status: row.status,
        displayName: row.displayName,
        sellerType: row.sellerType,
        applicantName: row.applicant.name,
        applicantEmail: row.applicant.email,
        submittedAt: row.submittedAt,
        createdAt: row.createdAt,
      })),
      total,
    };
  },
};
