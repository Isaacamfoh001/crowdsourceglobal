import { prisma } from "../../lib/db";
import type { VendorServiceView } from "./types";

const vendorServiceSelect = {
  id: true,
  name: true,
  description: true,
  startingPrice: true,
  currency: true,
  active: true,
  category: { select: { id: true, name: true, slug: true } },
  createdAt: true,
  updatedAt: true,
} as const;

function toView(row: {
  id: string;
  name: string;
  description: string | null;
  startingPrice: unknown;
  currency: string;
  active: boolean;
  category: { id: string; name: string; slug: string };
  createdAt: Date;
  updatedAt: Date;
}): VendorServiceView {
  return { ...row, startingPrice: row.startingPrice === null ? null : Number(row.startingPrice).toFixed(2) };
}

export const beautyServicesRepository = {
  async listForProfile(professionalId: string): Promise<VendorServiceView[]> {
    const rows = await prisma.beautyService.findMany({
      where: { professionalId },
      select: vendorServiceSelect,
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toView);
  },

  async findForProfile(professionalId: string, id: string): Promise<VendorServiceView | null> {
    const row = await prisma.beautyService.findFirst({ where: { id, professionalId }, select: vendorServiceSelect });
    return row ? toView(row) : null;
  },

  create(professionalId: string, data: { name: string; description: string | null; categoryId: string; startingPrice: string | null; currency: string }) {
    return prisma.beautyService.create({ data: { professionalId, ...data }, select: vendorServiceSelect }).then(toView);
  },

  async updateForProfile(professionalId: string, id: string, data: Record<string, unknown>): Promise<boolean> {
    const result = await prisma.beautyService.updateMany({ where: { id, professionalId }, data });
    return result.count > 0;
  },

  async toggleActiveForProfile(professionalId: string, id: string, active: boolean): Promise<boolean> {
    const result = await prisma.beautyService.updateMany({ where: { id, professionalId }, data: { active } });
    return result.count > 0;
  },
};
