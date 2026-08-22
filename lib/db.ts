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
 *
 * `max` bounds the underlying `pg.Pool` (M13) — this runs as a single
 * Render web-service process, not a per-request serverless function, so one
 * bounded pool for the process's lifetime is the right unit to size, not
 * per-request/per-instance. See DATABASE_POOL_MAX in lib/env.ts.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
