import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "generated/**"],
    // M32 finding: most `modules/**/*.test.ts` files are integration tests
    // against the real local Postgres dev DB (see lib/db.ts) — each Vitest
    // fork is a separate process, so the PrismaClient singleton's
    // globalThis caching does NOT dedupe across forks; every fork opens its
    // own DATABASE_POOL_MAX-sized pg.Pool. At Vitest's default (one fork per
    // CPU core) that easily exceeds Postgres's connection headroom under
    // load, and queries queue past the 5s default test timeout — observed
    // as widespread, non-deterministic "Test timed out in 5000ms" failures
    // with no code-level cause. Bounding fork count and giving real DB
    // round-trips more headroom fixes this without touching product code.
    testTimeout: 15000,
    maxWorkers: 4,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
