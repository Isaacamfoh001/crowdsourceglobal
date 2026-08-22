import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { StorageProvider } from "./storage";

/**
 * Production adapter (M13) — Cloudflare R2 via its S3-compatible API. The
 * bucket is never public; the only callers are modules/sourcing and
 * modules/resolutions, and every download is already gated behind an
 * authenticated, ownership-checked route (app/api/sourcing/attachments/[id],
 * app/api/resolutions/attachments/[id]) that streams bytes through the app
 * rather than exposing a public/signed URL — this adapter preserves that,
 * it doesn't change the access model.
 *
 * Unlike LocalDiskStorageProvider (which treats every read failure as "not
 * found"), readObject here distinguishes a genuinely missing object (returns
 * null, same contract) from a real R2 failure (network/auth/5xx — rethrown,
 * so the download route's uncaught exception surfaces as a 500 instead of a
 * misleading 404 telling a customer their evidence photo doesn't exist).
 */
export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(params: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${params.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: params.accessKeyId,
        secretAccessKey: params.secretAccessKey,
      },
    });
    this.bucket = params.bucket;
  }

  async putObject(params: { key: string; buffer: Buffer; contentType: string }): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );
  }

  async readObject(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) return null;
      const buffer = Buffer.from(await result.Body.transformToByteArray());
      return { buffer, contentType: result.ContentType ?? "application/octet-stream" };
    } catch (error) {
      if (error instanceof NoSuchKey || (error as { name?: string } | null)?.name === "NoSuchKey") {
        return null;
      }
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    // S3-compatible DELETE is idempotent by design — deleting an already-
    // absent key is not an error, matching LocalDiskStorageProvider's contract.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
