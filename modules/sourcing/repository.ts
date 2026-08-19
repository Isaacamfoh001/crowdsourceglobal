import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { paginationSkip } from "../../lib/pagination";
import type { SourcingRequestStatus } from "./types";

const attachmentSelect = {
  id: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
} as const;

const customerDetailSelect = {
  id: true,
  requestNumber: true,
  status: true,
  title: true,
  description: true,
  quantity: true,
  quantityUnit: true,
  specifications: true,
  requiredByDate: true,
  deliveryCountry: true,
  deliveryRegion: true,
  deliveryCity: true,
  budgetAmount: true,
  budgetCurrency: true,
  unableToSourceReason: true,
  submittedAt: true,
  customerProfileId: true,
  attachments: { select: attachmentSelect, orderBy: { createdAt: "asc" as const } },
  quotations: {
    select: { id: true, reference: true, status: true, total: true, currency: true, issuedAt: true },
    orderBy: { issuedAt: "desc" as const },
    take: 1,
  },
} as const;

const adminOptionSelect = {
  id: true,
  sourceType: true,
  vendorId: true,
  vendor: { select: { companyName: true } },
  vendorListingId: true,
  vendorListing: { select: { title: true } },
  externalSupplierName: true,
  externalSupplierContact: true,
  quantityAvailable: true,
  proposedQuantity: true,
  unitSupplyCost: true,
  currency: true,
  leadTimeDays: true,
  originCountry: true,
  notes: true,
  allocations: { select: { allocatedQuantity: true } },
} as const;

const adminDetailSelect = {
  ...customerDetailSelect,
  assignedStaffId: true,
  assignedStaff: { select: { user: { select: { name: true } } } },
  customerProfile: { select: { displayName: true, user: { select: { email: true } } } },
  options: { select: adminOptionSelect, orderBy: { createdAt: "asc" as const } },
  allocations: {
    select: {
      id: true,
      sourcingOptionId: true,
      allocatedQuantity: true,
      unitSupplyCostSnapshot: true,
      currency: true,
      leadTimeDaysSnapshot: true,
      originCountrySnapshot: true,
      sourcingOption: { select: { sourceType: true, vendor: { select: { companyName: true } }, externalSupplierName: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  quotations: {
    select: { id: true, reference: true, status: true, total: true, currency: true, issuedAt: true },
    orderBy: { issuedAt: "desc" as const },
  },
  activities: {
    select: { id: true, type: true, createdAt: true, actorUserId: true, metadata: true },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

export const sourcingRepository = {
  /** Request + attachments + the "submitted" activity entry all in one transaction. */
  createRequestTransactional(
    customerProfileId: string,
    requestNumber: string,
    data: Omit<Prisma.CustomSourcingRequestUncheckedCreateInput, "requestNumber" | "customerProfileId">,
    attachments: { storageKey: string; filename: string; mimeType: string; sizeBytes: number }[],
    submittedByUserId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.customSourcingRequest.create({
        data: { requestNumber, customerProfileId, ...data },
        select: { id: true, requestNumber: true },
      });
      if (attachments.length > 0) {
        await tx.sourcingRequestAttachment.createMany({
          data: attachments.map((file) => ({ ...file, sourcingRequestId: request.id, uploadedByUserId: submittedByUserId })),
        });
      }
      await tx.sourcingRequestActivity.create({
        data: { sourcingRequestId: request.id, type: "submitted", actorUserId: submittedByUserId },
      });
      return request;
    });
  },

  createActivity(sourcingRequestId: string, type: string, actorUserId: string | null, metadata?: Record<string, unknown>) {
    return prisma.sourcingRequestActivity.create({
      data: { sourcingRequestId, type, actorUserId, metadata: metadata as Prisma.InputJsonValue },
    });
  },

  async findSummariesForCustomer(customerProfileId: string, page: number, pageSize: number) {
    const where = { customerProfileId };
    const [rows, total] = await Promise.all([
      prisma.customSourcingRequest.findMany({
        where,
        select: {
          id: true,
          requestNumber: true,
          title: true,
          quantity: true,
          quantityUnit: true,
          status: true,
          submittedAt: true,
          quotations: { select: { id: true }, take: 1 },
        },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.customSourcingRequest.count({ where }),
    ]);
    return { rows, total };
  },

  findDetailForCustomer(id: string, customerProfileId: string) {
    return prisma.customSourcingRequest.findFirst({
      where: { id, customerProfileId },
      select: customerDetailSelect,
    });
  },

  /** Ownership-scoped, minimal — used by the cancel action. */
  findForCancellation(id: string, customerProfileId: string) {
    return prisma.customSourcingRequest.findFirst({
      where: { id, customerProfileId },
      select: { id: true, status: true },
    });
  },

  async cancel(id: string, fromStatuses: SourcingRequestStatus[]) {
    const result = await prisma.customSourcingRequest.updateMany({
      where: { id, status: { in: fromStatuses } },
      data: { status: "CANCELLED", closedAt: new Date() },
    });
    return result.count === 1;
  },

  /** Ownership/authorization-neutral — callers (route handler) apply the actual access check. */
  findAttachmentForAccess(attachmentId: string) {
    return prisma.sourcingRequestAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        storageKey: true,
        filename: true,
        mimeType: true,
        sourcingRequest: { select: { id: true, customerProfileId: true } },
      },
    });
  },

  // --- Admin -------------------------------------------------------------

  listForAdmin(filter: { status?: SourcingRequestStatus; assignedStaffId?: string }) {
    return prisma.customSourcingRequest.findMany({
      where: {
        status: filter.status,
        assignedStaffId: filter.assignedStaffId,
      },
      select: {
        id: true,
        requestNumber: true,
        title: true,
        quantity: true,
        quantityUnit: true,
        status: true,
        submittedAt: true,
        updatedAt: true,
        requiredByDate: true,
        customerProfile: { select: { displayName: true } },
        assignedStaffId: true,
        assignedStaff: { select: { user: { select: { name: true } } } },
        quotations: { select: { id: true }, take: 1 },
      },
      orderBy: { submittedAt: "desc" },
      take: 200,
    });
  },

  /**
   * (M11.1) Paginated variant of listForAdmin, for the admin sourcing
   * requests queue page. listForAdmin itself stays unbounded (capped at
   * 200) — it's also used by admin-dashboard's sourcingAttention(), which
   * needs the full open set to scan for unassigned/stale/deadline-risk
   * requests, not one page of it.
   */
  async listForAdminPaginated(filter: { status?: SourcingRequestStatus; assignedStaffId?: string }, page: number, pageSize: number) {
    const where = {
      status: filter.status,
      assignedStaffId: filter.assignedStaffId,
    };
    const [rows, total] = await Promise.all([
      prisma.customSourcingRequest.findMany({
        where,
        select: {
          id: true,
          requestNumber: true,
          title: true,
          quantity: true,
          quantityUnit: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          requiredByDate: true,
          customerProfile: { select: { displayName: true } },
          assignedStaffId: true,
          assignedStaff: { select: { user: { select: { name: true } } } },
          quotations: { select: { id: true }, take: 1 },
        },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.customSourcingRequest.count({ where }),
    ]);
    return { rows, total };
  },

  findDetailForAdmin(id: string) {
    return prisma.customSourcingRequest.findUnique({
      where: { id },
      select: adminDetailSelect,
    });
  },

  findStatusForUpdate(id: string) {
    return prisma.customSourcingRequest.findUnique({ where: { id }, select: { id: true, status: true, quantity: true } });
  },

  assignStaff(id: string, staffId: string | null) {
    return prisma.customSourcingRequest.update({ where: { id }, data: { assignedStaffId: staffId } });
  },

  async updateStatus(
    id: string,
    fromStatuses: SourcingRequestStatus[],
    toStatus: SourcingRequestStatus,
    extra: Record<string, unknown> = {},
  ) {
    const result = await prisma.customSourcingRequest.updateMany({
      where: { id, status: { in: fromStatuses } },
      data: { status: toStatus, ...extra },
    });
    return result.count === 1;
  },

  addOption(sourcingRequestId: string, data: Record<string, unknown>) {
    return prisma.sourcingOption.create({
      data: { sourcingRequestId, ...data } as Prisma.SourcingOptionUncheckedCreateInput,
    });
  },

  removeOption(id: string, sourcingRequestId: string) {
    return prisma.sourcingOption.deleteMany({ where: { id, sourcingRequestId } });
  },

  findOptionsForRequest(sourcingRequestId: string) {
    return prisma.sourcingOption.findMany({
      where: { sourcingRequestId },
      select: { id: true, sourceType: true, vendorId: true, unitSupplyCost: true, currency: true, leadTimeDays: true, originCountry: true, proposedQuantity: true },
    });
  },

  async replaceAllocations(
    sourcingRequestId: string,
    allocations: { sourcingOptionId: string; allocatedQuantity: number; unitSupplyCostSnapshot: number; currency: string; leadTimeDaysSnapshot: number | null; originCountrySnapshot: string | null }[],
  ) {
    await prisma.$transaction([
      prisma.sourcingAllocation.deleteMany({ where: { sourcingRequestId } }),
      prisma.sourcingAllocation.createMany({ data: allocations.map((a) => ({ ...a, sourcingRequestId })) }),
    ]);
  },

  findVendorNamesByIds(vendorIds: string[]) {
    return prisma.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, companyName: true } });
  },

  listApprovedVendorsForPicker() {
    return prisma.vendor.findMany({
      where: { verificationStatus: "APPROVED" },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    });
  },

  findOwnerEmailAndNumber(id: string) {
    return prisma.customSourcingRequest.findUnique({
      where: { id },
      select: {
        requestNumber: true,
        customerProfileId: true,
        customerProfile: { select: { userId: true, user: { select: { email: true } } } },
      },
    });
  },
};
