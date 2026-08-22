import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, normalize } from "node:path";
import { env } from "./env";
import { R2StorageProvider } from "./storage-r2";

/**
 * Storage abstraction so domain/route code never depends on a specific
 * provider (CLAUDE.md §15/§54 — "do not couple domain logic to S3/
 * Cloudinary/etc"). Selected via STORAGE_PROVIDER (lib/env.ts):
 * `LocalDiskStorageProvider` for dev/test (default), `R2StorageProvider`
 * (lib/storage-r2.ts) for production (M13) — production cannot silently
 * fall back to local disk, see lib/env.ts's fail-closed check. Nothing
 * outside this file/storage-r2.ts needs to change — modules/sourcing and
 * the attachment route handlers only ever call the interface below.
 */
export type StorageProvider = {
  putObject(params: { key: string; buffer: Buffer; contentType: string }): Promise<void>;
  readObject(key: string): Promise<{ buffer: Buffer; contentType: string } | null>;
  deleteObject(key: string): Promise<void>;
};

/**
 * Development-only adapter. Files are written OUTSIDE the git-tracked
 * project tree entirely (CLAUDE.md's "do not store arbitrary user uploads
 * directly inside the application repository") — under the OS user's home
 * directory by default, overridable via LOCAL_STORAGE_DIR for tests/CI.
 * Keys are opaque, randomized (see generateStorageKey) and never derived
 * from user-controlled filenames, so there is no path-traversal surface —
 * `normalize` + a prefix check is still applied defensively.
 */
class LocalDiskStorageProvider implements StorageProvider {
  private readonly rootDir: string;

  constructor() {
    this.rootDir = process.env["LOCAL_STORAGE_DIR"] || join(homedir(), ".crownsourceglobal-dev-storage");
  }

  private resolvePath(key: string): string {
    const resolved = normalize(join(this.rootDir, key));
    if (!resolved.startsWith(normalize(this.rootDir))) {
      throw new Error("Invalid storage key.");
    }
    return resolved;
  }

  async putObject(params: { key: string; buffer: Buffer; contentType: string }): Promise<void> {
    const path = this.resolvePath(params.key);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, params.buffer);
    // contentType is stored by the caller (SourcingRequestAttachment.mimeType in Postgres),
    // not alongside the file — this adapter only persists bytes.
  }

  async readObject(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const buffer = await readFile(this.resolvePath(key));
      return { buffer, contentType: "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await unlink(this.resolvePath(key));
    } catch {
      // Already gone — deletion is idempotent.
    }
  }
}

function buildStorageProvider(): StorageProvider {
  if (env.STORAGE_PROVIDER === "r2") {
    // env.ts already fails startup if these are missing when STORAGE_PROVIDER=r2.
    return new R2StorageProvider({
      accountId: env.R2_ACCOUNT_ID as string,
      accessKeyId: env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
      bucket: env.R2_BUCKET_NAME as string,
    });
  }
  return new LocalDiskStorageProvider();
}

export const storageProvider: StorageProvider = buildStorageProvider();

/**
 * Opaque, non-guessable, never derived from a user-supplied filename.
 * `extension` is optional (e.g. ".png") — callers that need to recover a
 * content type from the key alone at serve time (M13.1's public product-
 * image route, which has no DB-backed mimeType column to read from, unlike
 * sourcing/resolution attachments) pass one; existing callers are
 * unaffected.
 */
export function generateStorageKey(prefix: string = "sourcing-attachments", extension: string = ""): string {
  return `${prefix}/${randomUUID()}${extension}`;
}
