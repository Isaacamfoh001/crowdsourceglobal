import "dotenv/config";
import { bootstrapReferenceData } from "../prisma/reference-data";

/**
 * Production-safe reference/bootstrap data for a fresh database. Creates
 * ONLY canonical Category rows — see prisma/reference-data.ts for the full
 * list and rationale. Never creates Users, Admins, Vendors, listings,
 * orders, payments, resolutions, settlements, or any other transactional or
 * demo data.
 *
 * Idempotent: safe to run multiple times, against a database with existing
 * real commerce activity, or concurrently with itself. Not run automatically
 * on deploy/startup — an explicit, one-time-per-environment operator command.
 *
 * Usage: npm run bootstrap:reference-data
 */
async function main() {
  console.log("[bootstrap:reference-data] starting...");
  const result = await bootstrapReferenceData();
  console.log(
    `[bootstrap:reference-data] categories: ${result.categoriesCreated} created, ` +
      `${result.categoriesUpdated} updated, ${result.categoriesUnchanged} already up to date.`,
  );
  console.log("[bootstrap:reference-data] done.");
  process.exit(0);
}

main().catch((error) => {
  console.error("[bootstrap:reference-data] fatal error:", error);
  process.exit(1);
});
