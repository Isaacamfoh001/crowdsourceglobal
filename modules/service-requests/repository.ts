import { prisma } from "../../lib/db";
import type { ServiceLocationMode } from "../../generated/prisma/client";
import { paginationSkip } from "../../lib/pagination";
import type { ServiceRequestView } from "./types";

const viewSelect = {
  id: true,
  status: true,
  preferredDate: true,
  preferredTimeNote: true,
  locationMode: true,
  locationDetails: true,
  notes: true,
  quantity: true,
  referenceImage: true,
  declineReason: true,
  createdAt: true,
  updatedAt: true,
  professional: { select: { id: true, displayName: true } },
  service: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
} as const;

function toView(row: {
  id: string;
  status: string;
  preferredDate: Date;
  preferredTimeNote: string | null;
  locationMode: string;
  locationDetails: string | null;
  notes: string | null;
  quantity: number;
  referenceImage: string | null;
  declineReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  professional: { id: string; displayName: string };
  service: { id: string; name: string };
  customer: { id: string; name: string };
}): ServiceRequestView {
  return {
    ...row,
    professional: { id: row.professional.id, name: row.professional.displayName },
  };
}

export const serviceRequestsRepository = {
  async findCustomerContact(customerUserId: string): Promise<{ email: string } | null> {
    const user = await prisma.user.findUnique({ where: { id: customerUserId }, select: { email: true } });
    return user ? { email: user.email } : null;
  },

  create(
    customerUserId: string,
    data: {
      professionalId: string;
      serviceId: string;
      preferredDate: Date;
      preferredTimeNote: string | null;
      locationMode: ServiceLocationMode;
      locationDetails: string | null;
      notes: string | null;
      quantity: number;
      referenceImage: string | null;
    },
  ) {
    return prisma.serviceRequest.create({ data: { customerUserId, ...data }, select: viewSelect }).then(toView);
  },

  // --- Customer (own requests) ------------------------------------------

  async findForCustomerPaginated(customerUserId: string, page: number, pageSize: number) {
    const where = { customerUserId };
    const [rows, total] = await Promise.all([
      prisma.serviceRequest.findMany({ where, select: viewSelect, orderBy: [{ createdAt: "desc" }], skip: paginationSkip(page, pageSize), take: pageSize }),
      prisma.serviceRequest.count({ where }),
    ]);
    return { rows: rows.map(toView), total };
  },

  async findForCustomer(customerUserId: string, id: string): Promise<ServiceRequestView | null> {
    const row = await prisma.serviceRequest.findFirst({ where: { id, customerUserId }, select: viewSelect });
    return row ? toView(row) : null;
  },

  async cancelForCustomer(customerUserId: string, id: string): Promise<boolean> {
    const result = await prisma.serviceRequest.updateMany({
      where: { id, customerUserId, status: "SUBMITTED" },
      data: { status: "CANCELLED" },
    });
    return result.count > 0;
  },

  // --- Provider (incoming requests) ---------------------------------------

  async findForProfessionalPaginated(professionalId: string, page: number, pageSize: number) {
    const where = { professionalId };
    const [rows, total] = await Promise.all([
      prisma.serviceRequest.findMany({ where, select: viewSelect, orderBy: [{ createdAt: "desc" }], skip: paginationSkip(page, pageSize), take: pageSize }),
      prisma.serviceRequest.count({ where }),
    ]);
    return { rows: rows.map(toView), total };
  },

  async findForProfessional(professionalId: string, id: string): Promise<ServiceRequestView | null> {
    const row = await prisma.serviceRequest.findFirst({ where: { id, professionalId }, select: viewSelect });
    return row ? toView(row) : null;
  },

  async acceptForProfessional(professionalId: string, id: string): Promise<boolean> {
    const result = await prisma.serviceRequest.updateMany({
      where: { id, professionalId, status: "SUBMITTED" },
      data: { status: "PROVIDER_ACCEPTED", respondedAt: new Date() },
    });
    return result.count > 0;
  },

  async declineForProfessional(professionalId: string, id: string, reason: string | null): Promise<boolean> {
    const result = await prisma.serviceRequest.updateMany({
      where: { id, professionalId, status: "SUBMITTED" },
      data: { status: "PROVIDER_DECLINED", declineReason: reason, respondedAt: new Date() },
    });
    return result.count > 0;
  },

  // --- Admin (full operational visibility) --------------------------------

  async findAllForAdminPaginated(page: number, pageSize: number) {
    const [rows, total] = await Promise.all([
      prisma.serviceRequest.findMany({ select: viewSelect, orderBy: [{ createdAt: "desc" }], skip: paginationSkip(page, pageSize), take: pageSize }),
      prisma.serviceRequest.count(),
    ]);
    return { rows: rows.map(toView), total };
  },

  async findForAdmin(id: string): Promise<ServiceRequestView | null> {
    const row = await prisma.serviceRequest.findUnique({ where: { id }, select: viewSelect });
    return row ? toView(row) : null;
  },
};
