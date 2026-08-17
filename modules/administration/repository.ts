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

  /** Feeds M7 staff-attention notifications (new vendor application, new sourcing request, new message). */
  listAllForNotification() {
    return prisma.adminUser.findMany({ select: { userId: true, user: { select: { email: true } } } });
  },
};
