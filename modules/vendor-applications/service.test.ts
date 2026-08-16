import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { vendorApplicationsService } from "./service";
import * as emailModule from "../../lib/email";

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 150));
}

/** Integration tests against the real local Postgres dev database. */
describe("vendorApplicationsService", () => {
  let applicantUserId: string;
  let adminUserId: string;
  const createdUserIds: string[] = [];
  const createdApplicationIds: string[] = [];
  const createdVendorIds: string[] = [];

  const validBusiness = {
    displayName: "Adepa Beauty Supplies",
    storeDescription: "We supply hair and beauty products across Accra.",
    country: "Ghana",
    region: "Greater Accra",
    city: "Accra",
    addressLine1: "12 Ring Road",
  };
  const validContact = {
    contactName: "Adepa Owusu",
    contactEmail: "adepa@example.com",
    contactPhone: "0244000111",
  };
  const validOperations = {
    categorySlugs: ["hair-beauty-supplies"],
    sellingMode: "retail",
    bulkCapable: false,
  };

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const applicant = await prisma.user.create({
      data: { id: `va-applicant-${suffix}`, name: "Applicant", email: `va.applicant.${suffix}@example.com` },
    });
    applicantUserId = applicant.id;
    createdUserIds.push(applicant.id);

    const admin = await prisma.user.create({
      data: { id: `va-admin-${suffix}`, name: "Admin", email: `va.admin.${suffix}@example.com` },
    });
    adminUserId = admin.id;
    createdUserIds.push(admin.id);
  });

  afterAll(async () => {
    await prisma.vendorMembership.deleteMany({ where: { vendorId: { in: createdVendorIds } } });
    await prisma.vendorApplication.deleteMany({ where: { id: { in: createdApplicationIds } } });
    await prisma.vendor.deleteMany({ where: { id: { in: createdVendorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  async function trackApplication() {
    const app = await vendorApplicationsService.getForUser(applicantUserId);
    if (app) createdApplicationIds.push(app.id);
  }

  it("creates a draft and allows resuming it", async () => {
    const first = await vendorApplicationsService.getOrCreateForUser(applicantUserId);
    await trackApplication();
    expect(first.status).toBe("DRAFT");

    const resumed = await vendorApplicationsService.getOrCreateForUser(applicantUserId);
    expect(resumed.id).toBe(first.id); // same row reused, not a new draft
  });

  it("saves each step and enforces seller-type-conditional validation at submit", async () => {
    await vendorApplicationsService.getOrCreateForUser(applicantUserId);
    await trackApplication();

    await vendorApplicationsService.saveSellerType(applicantUserId, { sellerType: "REGISTERED_BUSINESS" });
    await vendorApplicationsService.saveContact(applicantUserId, validContact);
    await vendorApplicationsService.saveBusiness(applicantUserId, validBusiness); // no registrationNumber
    await vendorApplicationsService.saveOperations(applicantUserId, validOperations);

    const missingRegistration = await vendorApplicationsService.submit(applicantUserId);
    expect(missingRegistration.ok).toBe(false); // REGISTERED_BUSINESS requires a registration number

    await vendorApplicationsService.saveBusiness(applicantUserId, { ...validBusiness, registrationNumber: "BN-123" });
    const submitted = await vendorApplicationsService.submit(applicantUserId);
    expect(submitted.ok).toBe(true);

    const application = await vendorApplicationsService.getForUser(applicantUserId);
    expect(application?.status).toBe("SUBMITTED");
  });

  it("does not require a registration number for an individual seller", async () => {
    await vendorApplicationsService.getOrCreateForUser(applicantUserId);
    await trackApplication();

    await vendorApplicationsService.saveSellerType(applicantUserId, { sellerType: "INDIVIDUAL" });
    await vendorApplicationsService.saveContact(applicantUserId, validContact);
    await vendorApplicationsService.saveBusiness(applicantUserId, validBusiness);
    await vendorApplicationsService.saveOperations(applicantUserId, validOperations);

    const result = await vendorApplicationsService.submit(applicantUserId);
    expect(result.ok).toBe(true);
  });

  it("rejects invalid state transitions — cannot edit once submitted", async () => {
    await vendorApplicationsService.getOrCreateForUser(applicantUserId);
    await trackApplication();
    await vendorApplicationsService.saveSellerType(applicantUserId, { sellerType: "INDIVIDUAL" });
    await vendorApplicationsService.saveContact(applicantUserId, validContact);
    await vendorApplicationsService.saveBusiness(applicantUserId, validBusiness);
    await vendorApplicationsService.saveOperations(applicantUserId, validOperations);
    await vendorApplicationsService.submit(applicantUserId);

    const editAfterSubmit = await vendorApplicationsService.saveContact(applicantUserId, {
      ...validContact,
      contactName: "Changed Name",
    });
    expect(editAfterSubmit.ok).toBe(false);
  });

  it("a non-owner cannot edit another user's application", async () => {
    await vendorApplicationsService.getOrCreateForUser(applicantUserId);
    await trackApplication();

    const otherUser = await prisma.user.create({
      data: { id: `va-other-${Date.now()}`, name: "Other", email: `va.other.${Date.now()}@example.com` },
    });
    createdUserIds.push(otherUser.id);

    const result = await vendorApplicationsService.saveContact(otherUser.id, validContact);
    expect(result.ok).toBe(false); // no application exists for this user — cannot edit someone else's by id
  });

  async function submitFullApplication() {
    await vendorApplicationsService.getOrCreateForUser(applicantUserId);
    await trackApplication();
    await vendorApplicationsService.saveSellerType(applicantUserId, { sellerType: "INDIVIDUAL" });
    await vendorApplicationsService.saveContact(applicantUserId, validContact);
    await vendorApplicationsService.saveBusiness(applicantUserId, validBusiness);
    await vendorApplicationsService.saveOperations(applicantUserId, validOperations);
    await vendorApplicationsService.submit(applicantUserId);
    const application = await vendorApplicationsService.getForUser(applicantUserId);
    return application!;
  }

  it("prevents an applicant from approving their own application", async () => {
    const application = await submitFullApplication();
    const result = await vendorApplicationsService.approve(applicantUserId, application.id);
    expect(result.ok).toBe(false);
  });

  it("approves an application, creating a Vendor and an OWNER VendorMembership", async () => {
    const application = await submitFullApplication();
    const result = await vendorApplicationsService.approve(adminUserId, application.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdVendorIds.push(result.value.vendorId);

    const vendor = await prisma.vendor.findUnique({ where: { id: result.value.vendorId } });
    expect(vendor?.verificationStatus).toBe("APPROVED");
    expect(vendor?.companyName).toBe(validBusiness.displayName);

    const membership = await prisma.vendorMembership.findUnique({
      where: { userId_vendorId: { userId: applicantUserId, vendorId: result.value.vendorId } },
    });
    expect(membership?.role).toBe("OWNER");

    const updatedApplication = await vendorApplicationsService.getForUser(applicantUserId);
    expect(updatedApplication?.status).toBe("APPROVED");
    expect(updatedApplication?.vendorId).toBe(result.value.vendorId);
  });

  it("sets CHANGES_REQUESTED with a reason the applicant can see, then allows resubmission", async () => {
    const application = await submitFullApplication();
    const result = await vendorApplicationsService.requestChanges(adminUserId, application.id, "Add a clearer store description.");
    expect(result.ok).toBe(true);

    const updated = await vendorApplicationsService.getForUser(applicantUserId);
    expect(updated?.status).toBe("CHANGES_REQUESTED");
    expect(updated?.decisionReason).toBe("Add a clearer store description.");

    // Applicant can edit again now that changes were requested.
    const editResult = await vendorApplicationsService.saveBusiness(applicantUserId, {
      ...validBusiness,
      storeDescription: "A clearer description of what we sell.",
    });
    expect(editResult.ok).toBe(true);

    const resubmit = await vendorApplicationsService.submit(applicantUserId);
    expect(resubmit.ok).toBe(true);
  });

  it("rejects an application with a visible reason", async () => {
    const application = await submitFullApplication();
    const result = await vendorApplicationsService.reject(adminUserId, application.id, "Unable to verify identity.");
    expect(result.ok).toBe(true);

    const updated = await vendorApplicationsService.getForUser(applicantUserId);
    expect(updated?.status).toBe("REJECTED");
    expect(updated?.decisionReason).toBe("Unable to verify identity.");
  });

  it("emails the applicant when their application is approved", async () => {
    const spy = vi.spyOn(emailModule, "sendVendorApplicationApprovedEmail").mockResolvedValue(undefined);
    const application = await submitFullApplication();

    const result = await vendorApplicationsService.approve(adminUserId, application.id);
    expect(result.ok).toBe(true);
    if (result.ok) createdVendorIds.push(result.value.vendorId);
    await flushMicrotasks();

    const applicantEmail = (await prisma.user.findUnique({ where: { id: applicantUserId } }))!.email;
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ to: applicantEmail, storeName: validBusiness.displayName }),
    );
    spy.mockRestore();
  });

  it("emails the applicant with the reason when changes are requested", async () => {
    const spy = vi.spyOn(emailModule, "sendVendorApplicationChangesRequestedEmail").mockResolvedValue(undefined);
    const application = await submitFullApplication();

    await vendorApplicationsService.requestChanges(adminUserId, application.id, "Add your registration number.");
    await flushMicrotasks();

    const applicantEmail = (await prisma.user.findUnique({ where: { id: applicantUserId } }))!.email;
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ to: applicantEmail, reason: "Add your registration number." }),
    );
    spy.mockRestore();
  });

  it("a failing email provider does not roll back or fail an already-successful approval", async () => {
    const spy = vi
      .spyOn(emailModule, "sendVendorApplicationApprovedEmail")
      .mockRejectedValue(new Error("simulated provider outage"));
    const application = await submitFullApplication();

    const result = await vendorApplicationsService.approve(adminUserId, application.id);
    expect(result.ok).toBe(true); // approval itself must still succeed
    if (result.ok) createdVendorIds.push(result.value.vendorId);

    const updated = await vendorApplicationsService.getForUser(applicantUserId);
    expect(updated?.status).toBe("APPROVED");
    spy.mockRestore();
  });
});
