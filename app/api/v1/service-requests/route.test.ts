// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";
import { beautyProfessionalsService } from "../../../../modules/beauty-professionals/service";
import { beautyServicesService } from "../../../../modules/beauty-services/service";

vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
import { GET, POST } from "./route";

type Session = Awaited<ReturnType<typeof getCurrentSession>>;

function sessionFor(user: { id: string; email: string; name: string }): Session {
  return {
    user: { ...user, emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
    session: { id: "s1", token: "t1", userId: user.id, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() },
  } as unknown as Session;
}

function postRequest(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request("http://localhost/api/v1/service-requests", { method: "POST", body: form });
}

function getRequest() {
  return new Request("http://localhost/api/v1/service-requests");
}

describe("POST/GET /api/v1/service-requests", () => {
  const createdUserIds: string[] = [];
  const createdVendorIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
  });

  afterAll(async () => {
    await prisma.serviceRequest.deleteMany({ where: { customerUserId: { in: createdUserIds } } });
    await prisma.beautyService.deleteMany({ where: { professional: { vendorId: { in: createdVendorIds } } } });
    await prisma.beautyProfessionalProfile.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated request submission (Request Service requires sign-in)", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await POST(postRequest({ professionalId: "x", serviceId: "y", preferredDate: new Date().toISOString(), locationMode: "PROVIDER_LOCATION" }));
    expect(response.status).toBe(401);
  });

  it("rejects an unauthenticated list request", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue(null);
    const response = await GET(getRequest());
    expect(response.status).toBe(401);
  });

  it("an authenticated customer can submit a request and see it in their own list, DTO-safe", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({ data: { companyName: "SR Route Vendor", storefrontSlug: `sr-route-${suffix}`, verificationStatus: "APPROVED" } });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.upsert({ where: { slug: "makeup-cosmetics" }, create: { name: "Makeup & Cosmetics", slug: "makeup-cosmetics" }, update: {} });
    await beautyProfessionalsService.submitOrUpdate(vendor.id, { displayName: "SR Route Professional", specialtyCategorySlugs: [category.slug], locationMode: "PROVIDER_LOCATION" });
    const profile = await beautyProfessionalsService.getForVendor(vendor.id);
    if (!profile) throw new Error("missing profile");
    await beautyProfessionalsService.approve(profile.id);
    const service = await beautyServicesService.create(vendor.id, { name: "Bridal Makeup", categoryId: category.id, startingPrice: "600" });
    if (!service.ok) throw new Error(service.error);

    const customer = await prisma.user.create({ data: { id: `sr-route-customer-${suffix}`, name: "Route Customer", email: `sr.route.customer.${suffix}@example.com` } });
    createdUserIds.push(customer.id);
    vi.mocked(getCurrentSession).mockResolvedValue(sessionFor({ id: customer.id, email: customer.email, name: customer.name }));

    const createResponse = await POST(
      postRequest({
        professionalId: profile.id,
        serviceId: service.value.id,
        preferredDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        locationMode: "PROVIDER_LOCATION",
        notes: "Please arrive early",
      }),
    );
    expect(createResponse.status).toBe(201);
    const createBody = await createResponse.json();
    expect(createBody.data.id).toEqual(expect.any(String));

    const listResponse = await GET(getRequest());
    const listBody = await listResponse.json();
    expect(listBody.data.rows.some((r: { id: string }) => r.id === createBody.data.id)).toBe(true);
    expect(Object.keys(listBody.data.rows[0]).sort()).toEqual(
      [
        "createdAt",
        "declineReason",
        "id",
        "locationDetails",
        "locationMode",
        "notes",
        "preferredDate",
        "preferredTimeNote",
        "professional",
        "quantity",
        "referenceImage",
        "service",
        "status",
        "updatedAt",
      ].sort(),
    );
  });
});
