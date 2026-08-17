import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, normalize } from "node:path";

/**
 * Storage abstraction so domain/route code never depends on a specific
 * provider (CLAUDE.md §15/§54 — "do not couple domain logic to S3/
 * Cloudinary/etc"). `LocalDiskStorageProvider` below is the ONLY
 * implementation today — no production object-storage provider has been
 * selected yet, per the M6 brief's explicit instruction not to invent
 * credentials or silently bind CrownSourceGlobal to a vendor.
 *
 * PRODUCTION DEPENDENCY: before a real deployment, replace
 * `LocalDiskStorageProvider` with an S3/R2-backed implementation of this
 * same interface (docs/architecture/overview.md lists this as an open
 * item). Nothing outside this file needs to change — modules/sourcing and
 * the attachment route handler only ever call the interface below.
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

export const storageProvider: StorageProvider = new LocalDiskStorageProvider();

/** Opaque, non-guessable, never derived from a user-supplied filename. */
export function generateStorageKey(): string {
  return `sourcing-attachments/${randomUUID()}`;
}
