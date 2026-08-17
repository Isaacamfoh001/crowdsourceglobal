import { prisma } from "../../lib/db";

export const administrationRepository = {
  findAdminUserByUserId(userId: string) {
    return prisma.adminUser.findUnique({
      where: { userId },
      select: { id: true, role: true, userId: true },
    });
  },

  /** Feeds the M6 sourcing-request staff-assignment picker. */
  listAll() {
    return prisma.adminUser.findMany({
      select: { id: true, role: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  /** Feeds the M6 "new sourcing request" staff notification. */
  listAllEmails() {
    return prisma.adminUser.findMany({ select: { user: { select: { email: true } } } });
  },
};
