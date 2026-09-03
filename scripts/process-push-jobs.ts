import "dotenv/config";
import { processPushQueue } from "../lib/push-worker";

/**
 * Standalone durable-push-job processor — the exact same shape as
 * scripts/process-email-jobs.ts. Run on a schedule in production; safe to
 * run concurrently with itself, the in-process dev-convenience drain, or
 * the email job processor (independent tables, independent guarded claims).
 *
 * Usage: npm run jobs:push
 */
async function main() {
  await processPushQueue();
  console.log("[jobs:push] queue drained.");
  process.exit(0);
}

main().catch((error) => {
  console.error("[jobs:push] fatal error:", error);
  process.exit(1);
});
