import { prisma } from "../../lib/db";

export const logisticsRepository = {
  listAll() {
    return prisma.receivingLocation.findMany({ orderBy: { createdAt: "asc" } });
  },

  listActive() {
    return prisma.receivingLocation.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  },

  /** The default assigned to a new international Fulfilment — the oldest active location. */
  findDefaultActive() {
    return prisma.receivingLocation.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  },

  findById(id: string) {
    return prisma.receivingLocation.findUnique({ where: { id } });
  },

  create(data: Record<string, unknown>) {
    return prisma.receivingLocation.create({ data: data as never });
  },

  update(id: string, data: Record<string, unknown>) {
    return prisma.receivingLocation.update({ where: { id }, data });
  },
};
