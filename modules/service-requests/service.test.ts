import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { serviceRequestsService } from "./service";
import { beautyProfessionalsService } from "../beauty-professionals/service";
import { beautyServicesService } from "../beauty-services/service";

/** Integration tests against the real local Postgres dev database — same convention as modules/explore-posts/service.test.ts. */
describe("serviceRequestsService", () => {
  let vendorAId: string;
  let vendorBId: string;
  let categoryId: string;
  let customerAId: string;
  let customerBId: string;
  let professionalAId: string;
  let professionalBId: string;
  let serviceAId: string;
  const createdVendorIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const vendorA = await prisma.vendor.create({ data: { companyName: "SR Test Vendor A", storefrontSlug: `sr-test-a-${suffix}`, verificationStatus: "APPROVED" } });
    vendorAId = vendorA.id;
    createdVendorIds.push(vendorA.id);

    const vendorB = await prisma.vendor.create({ data: { companyName: "SR Test Vendor B", storefrontSlug: `sr-test-b-${suffix}`, verificationStatus: "APPROVED" } });
    vendorBId = vendorB.id;
    createdVendorIds.push(vendorB.id);

    const userA = await prisma.user.create({ data: { id: `sr-owner-a-${suffix}`, name: "Provider A Owner", email: `sr.owner.a.${suffix}@example.com` } });
    await prisma.vendorMembership.create({ data: { userId: userA.id, vendorId: vendorAId, role: "OWNER" } });
    createdUserIds.push(userA.id);

    const userB = await prisma.user.create({ data: { id: `sr-owner-b-${suffix}`, name: "Provider B Owner", email: `sr.owner.b.${suffix}@example.com` } });
    await prisma.vendorMembership.create({ data: { userId: userB.id, vendorId: vendorBId, role: "OWNER" } });
    createdUserIds.push(userB.id);

    const customerA = await prisma.user.create({ data: { id: `sr-customer-a-${suffix}`, name: "Customer A", email: `sr.customer.a.${suffix}@example.com` } });
    customerAId = customerA.id;
    createdUserIds.push(customerA.id);

    const customerB = await prisma.user.create({ data: { id: `sr-customer-b-${suffix}`, name: "Customer B", email: `sr.customer.b.${suffix}@example.com` } });
    customerBId = customerB.id;
    createdUserIds.push(customerB.id);

    const category = await prisma.category.upsert({ where: { slug: "makeup-cosmetics" }, create: { name: "Makeup & Cosmetics", slug: "makeup-cosmetics" }, update: {} });
    categoryId = category.id;

    const submitA = await beautyProfessionalsService.submitOrUpdate(vendorAId, { displayName: "Provider A", specialtyCategorySlugs: ["makeup-cosmetics"], locationMode: "BOTH" });
    if (!submitA.ok) throw new Error(submitA.error);
    const profileA = await beautyProfessionalsService.getForVendor(vendorAId);
    if (!profileA) throw new Error("missing profile A");
    await beautyProfessionalsService.approve(profileA.id);
    professionalAId = profileA.id;

    const submitB = await beautyProfessionalsService.submitOrUpdate(vendorBId, { displayName: "Provider B", specialtyCategorySlugs: ["makeup-cosmetics"], locationMode: "PROVIDER_LOCATION" });
    if (!submitB.ok) throw new Error(submitB.error);
    const profileB = await beautyProfessionalsService.getForVendor(vendorBId);
    if (!profileB) throw new Error("missing profile B");
    await beautyProfessionalsService.approve(profileB.id);
    professionalBId = profileB.id;

    const serviceA = await beautyServicesService.create(vendorAId, { name: "Bridal Makeup", categoryId, startingPrice: "600" });
    if (!serviceA.ok) throw new Error(serviceA.error);
    serviceAId = serviceA.value.id;
  });

  afterAll(async () => {
    // Scoped by the accumulated createdVendorIds/createdUserIds arrays (every
    // beforeEach's vendors/users pushed onto them) — not the scalar
    // professionalAId/professionalBId vars, which only ever hold the LAST
    // test iteration's ids and would otherwise leave every earlier test's
    // rows orphaned in the shared local dev database.
    await prisma.serviceRequest.deleteMany({ where: { professional: { vendorId: { in: createdVendorIds } } } });
    await prisma.beautyService.deleteMany({ where: { professional: { vendorId: { in: createdVendorIds } } } });
    await prisma.beautyProfessionalProfile.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendorMembership.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.$disconnect();
  });

  const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  async function submitRequest(customerUserId: string) {
    const result = await serviceRequestsService.create(customerUserId, {
      professionalId: professionalAId,
      serviceId: serviceAId,
      preferredDate: tomorrow(),
      locationMode: "PROVIDER_LOCATION",
      notes: "Please arrive on time",
    });
    if (!result.ok) throw new Error(result.error);
    return result.value.id;
  }

  // --- Creation / validation -----------------------------------------------

  it("an authenticated customer can submit a request for a real, active service", async () => {
    const id = await submitRequest(customerAId);
    const request = await serviceRequestsService.getForCustomer(customerAId, id);
    expect(request?.status).toBe("SUBMITTED");
    expect(request?.service.id).toBe(serviceAId);
    expect(request?.professional.id).toBe(professionalAId);
  });

  it("rejects a request for a service that does not belong to the given professional", async () => {
    const result = await serviceRequestsService.create(customerAId, {
      professionalId: professionalBId, // wrong professional for serviceAId
      serviceId: serviceAId,
      preferredDate: tomorrow(),
      locationMode: "PROVIDER_LOCATION",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a request for an inactive service", async () => {
    const hidden = await beautyServicesService.create(vendorAId, { name: "Retired Service", categoryId });
    if (!hidden.ok) throw new Error(hidden.error);
    await beautyServicesService.toggleActive(vendorAId, hidden.value.id, false);

    const result = await serviceRequestsService.create(customerAId, {
      professionalId: professionalAId,
      serviceId: hidden.value.id,
      preferredDate: tomorrow(),
      locationMode: "PROVIDER_LOCATION",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a location mode the professional does not support", async () => {
    const serviceB = await beautyServicesService.create(vendorBId, { name: "Wig Install", categoryId });
    if (!serviceB.ok) throw new Error(serviceB.error);

    const result = await serviceRequestsService.create(customerAId, {
      professionalId: professionalBId, // PROVIDER_LOCATION only
      serviceId: serviceB.value.id,
      preferredDate: tomorrow(),
      locationMode: "CUSTOMER_LOCATION",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a preferred date in the past", async () => {
    const result = await serviceRequestsService.create(customerAId, {
      professionalId: professionalAId,
      serviceId: serviceAId,
      preferredDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      locationMode: "PROVIDER_LOCATION",
    });
    expect(result.ok).toBe(false);
  });

  // --- Ownership / IDOR -----------------------------------------------------

  it("a customer cannot access another customer's request", async () => {
    const id = await submitRequest(customerAId);
    const asOwner = await serviceRequestsService.getForCustomer(customerAId, id);
    const asOther = await serviceRequestsService.getForCustomer(customerBId, id);
    expect(asOwner).not.toBeNull();
    expect(asOther).toBeNull();
  });

  it("a provider cannot access another provider's requests", async () => {
    const id = await submitRequest(customerAId);
    const asOwner = await serviceRequestsService.getForProfessional(professionalAId, id);
    const asOther = await serviceRequestsService.getForProfessional(professionalBId, id);
    expect(asOwner).not.toBeNull();
    expect(asOther).toBeNull();
  });

  it("a provider cannot accept or decline another provider's request", async () => {
    const id = await submitRequest(customerAId);
    const acceptResult = await serviceRequestsService.accept(professionalBId, id);
    expect(acceptResult.ok).toBe(false);
    const declineResult = await serviceRequestsService.decline(professionalBId, id, "not mine");
    expect(declineResult.ok).toBe(false);

    const request = await serviceRequestsService.getForProfessional(professionalAId, id);
    expect(request?.status).toBe("SUBMITTED");
  });

  // --- State machine ----------------------------------------------------

  it("provider can accept their own SUBMITTED request", async () => {
    const id = await submitRequest(customerAId);
    const result = await serviceRequestsService.accept(professionalAId, id);
    expect(result.ok).toBe(true);
    const request = await serviceRequestsService.getForCustomer(customerAId, id);
    expect(request?.status).toBe("PROVIDER_ACCEPTED");
  });

  it("provider can decline their own SUBMITTED request with a reason", async () => {
    const id = await submitRequest(customerAId);
    const result = await serviceRequestsService.decline(professionalAId, id, "Fully booked that day");
    expect(result.ok).toBe(true);
    const request = await serviceRequestsService.getForCustomer(customerAId, id);
    expect(request?.status).toBe("PROVIDER_DECLINED");
    expect(request?.declineReason).toBe("Fully booked that day");
  });

  it("an already-decided request cannot be accepted or declined again (invalid transition)", async () => {
    const id = await submitRequest(customerAId);
    await serviceRequestsService.accept(professionalAId, id);

    const secondAccept = await serviceRequestsService.accept(professionalAId, id);
    expect(secondAccept.ok).toBe(false);
    const declineAfterAccept = await serviceRequestsService.decline(professionalAId, id, "too late");
    expect(declineAfterAccept.ok).toBe(false);
  });

  it("customer can cancel their own SUBMITTED request, but not once it has been decided", async () => {
    const id = await submitRequest(customerAId);
    const cancelled = await serviceRequestsService.cancel(customerAId, id);
    expect(cancelled.ok).toBe(true);
    expect((await serviceRequestsService.getForCustomer(customerAId, id))?.status).toBe("CANCELLED");

    const secondId = await submitRequest(customerAId);
    await serviceRequestsService.accept(professionalAId, secondId);
    const cancelAfterAccept = await serviceRequestsService.cancel(customerAId, secondId);
    expect(cancelAfterAccept.ok).toBe(false);
  });

  // --- Ordering / listing -------------------------------------------------

  it("provider's incoming requests are newest-first", async () => {
    const firstId = await submitRequest(customerAId);
    const secondId = await submitRequest(customerAId);

    const { rows } = await serviceRequestsService.listForProfessional(professionalAId, 1);
    const firstIndex = rows.findIndex((r) => r.id === firstId);
    const secondIndex = rows.findIndex((r) => r.id === secondId);
    expect(secondIndex).toBeLessThan(firstIndex);
  });

  it("customer's own list only contains their own requests", async () => {
    await submitRequest(customerAId);
    const { rows: rowsB } = await serviceRequestsService.listForCustomer(customerBId, 1);
    expect(rowsB.length).toBe(0);
  });
});
