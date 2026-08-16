import { prisma } from "../../lib/db";

export const administrationRepository = {
  findAdminUserByUserId(userId: string) {
    return prisma.adminUser.findUnique({
      where: { userId },
      select: { id: true, role: true, userId: true },
    });
  },
};
