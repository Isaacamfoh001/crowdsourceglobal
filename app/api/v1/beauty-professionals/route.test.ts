// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../lib/db";
import { beautyProfessionalsService } from "../../../../modules/beauty-professionals/service";
import { GET } from "./route";

function request(query: string = "") {
  return new Request(`http://localhost/api/v1/beauty-professionals${query}`);
}

describe("GET /api/v1/beauty-professionals", () => {
  const createdVendorIds: string[] = [];

  afterAll(async () => {
    await prisma.beautyProfessionalProfile.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  it("public DTO never leaks the Vendor's private contact fields", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const vendor = await prisma.vendor.create({
      data: {
        companyName: "Route Test Vendor",
        storefrontSlug: `bp-route-${suffix}`,
        verificationStatus: "APPROVED",
        contactEmail: "private-contact@example.com",
        contactPhone: "0200000000",
      },
    });
    createdVendorIds.push(vendor.id);
    const category = await prisma.category.upsert({ where: { slug: "makeup-cosmetics" }, create: { name: "Makeup & Cosmetics", slug: "makeup-cosmetics" }, update: {} });
    await beautyProfessionalsService.submitOrUpdate(vendor.id, { displayName: "Route Test Professional", specialtyCategorySlugs: [category.slug], locationMode: "PROVIDER_LOCATION" });
    const profile = await beautyProfessionalsService.getForVendor(vendor.id);
    if (!profile) throw new Error("missing profile");
    await beautyProfessionalsService.approve(profile.id);

    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("private-contact@example.com");
    expect(JSON.stringify(body)).not.toContain("0200000000");

    const row = body.data.rows.find((r: { id: string }) => r.id === profile.id);
    expect(row).toBeDefined();
    expect(Object.keys(row).sort()).toEqual(
      ["avatarUrl", "bio", "createdAt", "displayName", "fromPrice", "heroImageUrl", "id", "location", "specialties"].sort(),
    );
  });

  it("returns an empty envelope shape correctly for an unmatched category filter", async () => {
    const response = await GET(request("?category=not-a-real-category-slug"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.rows).toEqual([]);
    expect(body.data.nextCursor).toBeNull();
  });
});
