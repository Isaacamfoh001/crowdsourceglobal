import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { env } from "./env";

/**
 * Prisma client singleton. Next.js hot-reloads modules in dev, which would
 * otherwise create a new PrismaClient (and a new Postgres connection pool)
 * on every edit — cache it on `globalThis` to avoid exhausting connections.
 *
 * Prisma 7's client requires an explicit driver adapter (no more implicit
 * datasource-URL connection), hence @prisma/adapter-pg here.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg(env.DATABASE_URL);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
