import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The S3-compatible client is mocked — this suite never calls real
 * Cloudflare R2 (M13 brief). `send` captures every command's constructor
 * input so assertions can check exactly what was sent without depending on
 * @aws-sdk/client-s3's internal command shape.
 */
const send = vi.fn();

vi.mock("@aws-sdk/client-s3", () => {
  class MockS3Client {
    send = send;
  }
  class NoSuchKey extends Error {
    name = "NoSuchKey";
  }
  // Regular classes, not vi.fn()-wrapped arrow functions — the real SDK
  // commands are constructed with `new`, and an arrow function can never
  // be used as a constructor regardless of vi.fn() wrapping.
  class PutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class GetObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class DeleteObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return { S3Client: MockS3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, NoSuchKey };
});

const { R2StorageProvider } = await import("./storage-r2");

describe("R2StorageProvider", () => {
  const provider = new R2StorageProvider({
    accountId: "test-account",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    bucket: "test-bucket",
  });

  beforeEach(() => {
    send.mockReset();
  });

  it("putObject sends the bucket/key/body/contentType", async () => {
    send.mockResolvedValueOnce({});
    await provider.putObject({ key: "sourcing-attachments/abc", buffer: Buffer.from("hello"), contentType: "text/plain" });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]?.input).toEqual({
      Bucket: "test-bucket",
      Key: "sourcing-attachments/abc",
      Body: Buffer.from("hello"),
      ContentType: "text/plain",
    });
  });

  it("putObject propagates a genuine failure rather than swallowing it (Part G — no orphaned DB record claiming a safe upload)", async () => {
    send.mockRejectedValueOnce(new Error("R2 auth failed"));
    await expect(
      provider.putObject({ key: "sourcing-attachments/abc", buffer: Buffer.from("x"), contentType: "text/plain" }),
    ).rejects.toThrow("R2 auth failed");
  });

  it("readObject returns the buffer and contentType on success", async () => {
    const bytes = new TextEncoder().encode("file contents");
    send.mockResolvedValueOnce({
      ContentType: "application/pdf",
      Body: { transformToByteArray: async () => bytes },
    });

    const result = await provider.readObject("sourcing-attachments/abc");
    expect(result).toEqual({ buffer: Buffer.from(bytes), contentType: "application/pdf" });
  });

  it("readObject returns null for a missing object (NoSuchKey) — same contract as LocalDiskStorageProvider", async () => {
    const notFound = Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" });
    send.mockRejectedValueOnce(notFound);
    const result = await provider.readObject("missing-key");
    expect(result).toBeNull();
  });

  it("readObject rethrows a genuine R2 failure rather than reporting it as not-found", async () => {
    send.mockRejectedValueOnce(new Error("network timeout"));
    await expect(provider.readObject("some-key")).rejects.toThrow("network timeout");
  });

  it("deleteObject sends a delete for the given key", async () => {
    send.mockResolvedValueOnce({});
    await provider.deleteObject("sourcing-attachments/abc");

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]?.input).toEqual({ Bucket: "test-bucket", Key: "sourcing-attachments/abc" });
  });
});
