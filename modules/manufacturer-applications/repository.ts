import { prisma } from "../../lib/db";
import { paginationSkip } from "../../lib/pagination";
import type { ManufacturerApplicationView, AdminManufacturerApplicationSummary } from "./types";

const applicationSelect = {
  id: true,
  status: true,
  categorySlugs: true,
  categoryOther: true,
  submittedAt: true,
  reviewedAt: true,
  decisionReason: true,
  vendorId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const REVIEWABLE_STATUSES = ["SUBMITTED", "UNDER_REVIEW"];

export const manufacturerApplicationsRepository = {
  findForVendor(vendorId: string): Promise<ManufacturerApplicationView | null> {
    return prisma.manufacturerApplication.findUnique({ where: { vendorId }, select: applicationSelect });
  },

  createAndSubmit(vendorId: string, input: { categorySlugs: string[]; categoryOther: string | null }): Promise<ManufacturerApplicationView> {
    return prisma.manufacturerApplication.create({
      data: { vendorId, ...input, status: "SUBMITTED", submittedAt: new Date() },
      select: applicationSelect,
    });
  },

  updateForVendor(vendorId: string, data: Record<string, unknown>): Promise<ManufacturerApplicationView> {
    return prisma.manufacturerApplication.update({ where: { vendorId }, data, select: applicationSelect });
  },

  findById(id: string) {
    return prisma.manufacturerApplication.findUnique({
      where: { id },
      select: {
        ...applicationSelect,
        reviewerUserId: true,
        vendor: { select: { id: true, companyName: true, sellerType: true } },
      },
    });
  },

  async listForAdminPaginated(
    statuses: string[],
    page: number,
    pageSize: number,
  ): Promise<{ rows: AdminManufacturerApplicationSummary[]; total: number }> {
    const where = { status: { in: statuses as never[] } };
    const [rows, total] = await Promise.all([
      prisma.manufacturerApplication.findMany({
        where,
        select: {
          id: true,
          status: true,
          categorySlugs: true,
          categoryOther: true,
          submittedAt: true,
          createdAt: true,
          vendor: { select: { id: true, companyName: true, sellerType: true } },
        },
        // Oldest-first — same deliberate queue order as vendor-applications.
        orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.manufacturerApplication.count({ where }),
    ]);
    return {
      rows: rows.map((row) => ({
        id: row.id,
        status: row.status,
        categorySlugs: row.categorySlugs,
        categoryOther: row.categoryOther,
        vendorId: row.vendor.id,
        vendorName: row.vendor.companyName,
        vendorSellerType: row.vendor.sellerType,
        submittedAt: row.submittedAt,
        createdAt: row.createdAt,
      })),
      total,
    };
  },

  approve(id: string, reviewerUserId: string) {
    return prisma.manufacturerApplication.update({
      where: { id },
      data: { status: "APPROVED", reviewedAt: new Date(), reviewerUserId, decisionReason: null },
    });
  },

  requestChanges(id: string, reviewerUserId: string, reason: string) {
    return prisma.manufacturerApplication.update({
      where: { id },
      data: { status: "CHANGES_REQUESTED", reviewedAt: new Date(), reviewerUserId, decisionReason: reason },
    });
  },

  reject(id: string, reviewerUserId: string, reason: string) {
    return prisma.manufacturerApplication.update({
      where: { id },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewerUserId, decisionReason: reason },
    });
  },
};
