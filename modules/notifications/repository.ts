import { prisma } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { paginationSkip } from "../../lib/pagination";
import type { NotifyInput } from "./types";

export const notificationsRepository = {
  /**
   * Returns the created Notification, or `null` when the (recipientUserId,
   * eventKey) pair already exists — the dedup guarantee, not an error.
   */
  async create(input: NotifyInput) {
    try {
      return await prisma.$transaction(async (tx) => {
        const notification = await tx.notification.create({
          data: {
            recipientUserId: input.recipientUserId,
            type: input.type,
            title: input.title,
            body: input.body,
            targetUrl: input.targetUrl,
            eventKey: input.eventKey,
          },
        });
        if (input.email) {
          await tx.emailDeliveryJob.create({
            data: {
              notificationId: notification.id,
              to: input.email.to,
              subject: input.email.subject,
              templateKey: input.email.templateKey,
              templateData: input.email.templateData as Prisma.InputJsonValue,
            },
          });
        }
        return notification;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null; // already exists for this recipient+event — safe no-op
      }
      throw error;
    }
  },

  listForUser(userId: string, take = 50) {
    return prisma.notification.findMany({
      where: { recipientUserId: userId },
      orderBy: { createdAt: "desc" },
      take,
    });
  },

  /** (M11.1) Paginated variant for the account notifications history page — distinct from listForUser(userId, take), which the notification bell still uses for its fixed-size "recent" fetch. */
  async listForUserPaginated(userId: string, page: number, pageSize: number) {
    const where = { recipientUserId: userId };
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: paginationSkip(page, pageSize),
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);
    return { rows, total };
  },

  countUnread(userId: string) {
    return prisma.notification.count({ where: { recipientUserId: userId, readAt: null } });
  },

  findByIdForUser(id: string, userId: string) {
    return prisma.notification.findFirst({ where: { id, recipientUserId: userId } });
  },

  async markRead(id: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: { id, recipientUserId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count === 1;
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { recipientUserId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  },

  findPreferences(userId: string) {
    return prisma.notificationPreference.findUnique({ where: { userId } });
  },

  upsertPreferences(userId: string, data: { ordersDeliveryEmail?: boolean; quotationsSourcingEmail?: boolean; messagesEmail?: boolean }) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },

  // --- Email job worker -------------------------------------------------

  /**
   * `attempts < maxAttempts` can't be expressed as a single Prisma `where`
   * (no column-to-column comparison), so eligibility is fetched as a small
   * candidate batch and filtered in application code before claiming —
   * cheap at this table's realistic size, and avoids raw SQL for a
   * one-line comparison.
   *
   * Walks the whole candidate batch rather than trying only the first
   * eligible row: under concurrent drain calls (multiple job-runner
   * invocations overlapping in production, or — as observed directly in
   * this project's test suite — multiple test files draining the same
   * shared dev database at once), losing the claim race on one row must
   * not abandon the rest of an otherwise-eligible batch.
   */
  async claimNextJob() {
    const candidates = await prisma.emailDeliveryJob.findMany({
      where: { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: new Date() } },
      orderBy: { availableAt: "asc" },
      take: 20,
    });

    for (const candidate of candidates) {
      if (candidate.attempts >= candidate.maxAttempts) continue;

      const claimed = await prisma.emailDeliveryJob.updateMany({
        where: { id: candidate.id, status: candidate.status },
        data: { status: "SENDING", attempts: { increment: 1 } },
      });
      if (claimed.count === 1) {
        return prisma.emailDeliveryJob.findUnique({ where: { id: candidate.id } });
      }
      // Lost the race to another concurrent drain — try the next candidate.
    }
    return null;
  },

  markJobSent(id: string) {
    return prisma.emailDeliveryJob.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
  },

  markJobFailed(id: string, error: string, nextAvailableAt: Date | null) {
    return prisma.emailDeliveryJob.update({
      where: { id },
      data: nextAvailableAt
        ? { status: "FAILED", lastError: error, availableAt: nextAvailableAt }
        : { status: "FAILED", lastError: error },
    });
  },
};
