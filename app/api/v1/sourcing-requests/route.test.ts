// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";

vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
import { GET, POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function sessionFor(user: { id: string; email: string; name: string }): Session {
  return {
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId: user.id, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function postRequest(fields: Record<string, string>, files: { field: string; buffer: Buffer; filename: string; type: string }[] = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  for (const file of files) form.append(file.field, new File([new Uint8Array(file.buffer)], file.filename, { type: file.type }));
  return new Request("http://localhost/api/v1/sourcing-requests", { method: "POST", body: form });
}

function getRequest(query = "") {
  return new Request(`http://localhost/api/v1/sourcing-requests${query}`);
}

describe("POST/GET /api/v1/sourcing-requests", () => {
  const createdUserIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.sourcingRequestAttachment.deleteMany({ where: { sourcingRequest: { customerProfile: { userId: { in: createdUserIds } } } } });
    await prisma.sourcingRequestActivity.deleteMany({ where: { sourcingRequest: { customerProfile: { userId: { in: createdUserIds } } } } });
    await prisma.customSourcingRequest.deleteMany({ where: { customerProfile: { userId: { in: createdUserIds } } } });
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function createCustomer(label: string) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({ data: { id: `sourcing-route-${label}-${suffix}`, name: `Route ${label}`, email: `sourcing.route.${label}.${suffix}@example.com` } });
    createdUserIds.push(user.id);
    await prisma.customerProfile.create({ data: { userId: user.id, displayName: `Route ${label}` } });
    return user;
  }

  it("rejects an unauthenticated submission", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(postRequest({ description: "500 tote bags", quantity: "500", deliveryCountry: "Ghana" }));
    expect(response.status).toBe(401);
  });

  it("rejects an unauthenticated list request", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(getRequest());
    expect(response.status).toBe(401);
  });

  it("rejects a submission with neither a photo nor a description (M24 photo-first rule)", async () => {
    const user = await createCustomer("neither");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await POST(postRequest({ description: "", quantity: "10", deliveryCountry: "Ghana" }));
    expect(response.status).toBe(422);
  });

  it("accepts a photo-only submission, auto-derives a title, and the summary DTO includes a thumbnail", async () => {
    const user = await createCustomer("photo-only");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));

    const createResponse = await POST(
      postRequest({ description: "", quantity: "3", deliveryCountry: "Ghana" }, [
        { field: "attachments", buffer: PNG_MAGIC, filename: "item.png", type: "image/png" },
      ]),
    );
    expect(createResponse.status).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody.data.id).toEqual(expect.any(String));
    expect(createBody.data.requestNumber).toEqual(expect.any(String));

    const listResponse = await GET(getRequest());
    const listBody = await listResponse.json();
    const row = listBody.data.rows.find((r: { id: string }) => r.id === createBody.data.id);
    expect(row.title).toBe("Photo sourcing request");
    expect(row.thumbnail).toMatch(/^https?:\/\/.*\/api\/sourcing\/attachments\//);
    expect(Object.keys(row).sort()).toEqual(
      ["hasQuotation", "id", "quantity", "quantityUnit", "requestNumber", "status", "statusLabel", "submittedAt", "thumbnail", "title"].sort(),
    );
  });

  it("accepts a description-only submission with no attachments", async () => {
    const user = await createCustomer("desc-only");
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(user));
    const response = await POST(postRequest({ description: "500 branded tote bags, navy canvas", quantity: "500", deliveryCountry: "Ghana" }));
    expect(response.status).toBe(201);
  });

  it("scopes the list to the signed-in customer's own requests only", async () => {
    const owner = await createCustomer("owner");
    const other = await createCustomer("other");

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(owner));
    const created = await POST(postRequest({ description: "Owner's request", quantity: "1", deliveryCountry: "Ghana" }));
    const createdBody = await created.json();

    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor(other));
    const otherList = await GET(getRequest());
    const otherBody = await otherList.json();
    expect(otherBody.data.rows.some((r: { id: string }) => r.id === createdBody.data.id)).toBe(false);
  });
});
