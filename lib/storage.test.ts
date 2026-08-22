import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Provider selection (M13) — lib/storage.ts picks LocalDiskStorageProvider
 * vs R2StorageProvider at module-load time based on env.STORAGE_PROVIDER.
 * Each case mocks ./env and re-imports the module fresh via
 * vi.resetModules() so the top-level `buildStorageProvider()` call reruns
 * against that case's env. No real R2 call happens here — constructing
 * R2StorageProvider just builds an S3Client object, it doesn't connect.
 */
describe("storage provider selection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("./env");
  });

  it("defaults to LocalDiskStorageProvider when STORAGE_PROVIDER is local", async () => {
    vi.doMock("./env", () => ({ env: { STORAGE_PROVIDER: "local" } }));
    const { storageProvider } = await import("./storage");
    expect(storageProvider.constructor.name).toBe("LocalDiskStorageProvider");
  });

  it("selects R2StorageProvider when STORAGE_PROVIDER is r2 with credentials present", async () => {
    vi.doMock("./env", () => ({
      env: {
        STORAGE_PROVIDER: "r2",
        R2_ACCOUNT_ID: "acct",
        R2_ACCESS_KEY_ID: "key",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET_NAME: "bucket",
      },
    }));
    const { storageProvider } = await import("./storage");
    expect(storageProvider.constructor.name).toBe("R2StorageProvider");
  });
});
