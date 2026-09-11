import { ok, err, type Result } from "../../lib/result";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { administrationRepository } from "../administration/repository";
import { vendorsRepository } from "../vendors/repository";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import { manufacturerApplicationsRepository, REVIEWABLE_STATUSES } from "./repository";
import type { CategoryStepInput } from "./types";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

/**
 * Same mutual-exclusivity rule already enforced for a single-categoryId
 * selection (modules/vendor-listings/service.ts's resolveCategory,
 * modules/beauty-services/service.ts's resolveCategory), adapted to this
 * model's array-shaped categorySlugs: an ordinary category selection always
 * clears categoryOther (never stored alongside a real category); choosing
 * "Other / Not listed" instead (no real categorySlugs) requires a non-empty,
 * trimmed categoryOther.
 */
function normalizeCategorySelection(input: CategoryStepInput): Result<{ categorySlugs: string[]; categoryOther: string | null }> {
  const categorySlugs = input.categorySlugs ?? [];
  if (categorySlugs.length > 0) {
    return ok({ categorySlugs, categoryOther: null });
  }
  const other = input.categoryOther?.trim();
  if (!other) return err("Choose what you manufacture.");
  if (other.length > 200) return err("Description is too long.");
  return ok({ categorySlugs: [], categoryOther: other });
}

async function notifyVendorOwner(params: {
  vendorId: string;
  type: "MANUFACTURER_APPLICATION_SUBMITTED" | "MANUFACTURER_APPLICATION_APPROVED" | "MANUFACTURER_APPLICATION_CHANGES_REQUESTED" | "MANUFACTURER_APPLICATION_REJECTED";
  title: string;
  body: string;
  eventKey: string;
  emailTemplateKey: string;
  emailSubject: string;
  emailData: Record<string, unknown>;
}): Promise<void> {
  const owner = await vendorsRepository.findOwnerUserIdAndEmail(params.vendorId);
  if (!owner) return;
  await notificationsService.notify({
    recipientUserId: owner.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    targetUrl: notificationLinks.vendorPortal(),
    eventKey: params.eventKey,
    email: { to: owner.email, subject: params.emailSubject, templateKey: params.emailTemplateKey, templateData: params.emailData },
  });
}

async function notifySubmitted(vendorId: string, applicationId: string): Promise<void> {
  const vendor = await vendorsRepository.findStoreProfile(vendorId);
  const vendorName = vendor?.companyName ?? "your business";
  await notifyVendorOwner({
    vendorId,
    type: "MANUFACTURER_APPLICATION_SUBMITTED",
    title: "Manufacturer application received",
    body: `We've received your request to add Manufacturer capability for "${vendorName}".`,
    eventKey: `manufacturer-application-submitted:${applicationId}:${Date.now()}`,
    emailTemplateKey: "manufacturer-application-submitted",
    emailSubject: "We've received your manufacturer application",
    emailData: { vendorName },
  });
  await notifyStaffOfNewApplication(vendorName, applicationId);
}

async function notifyStaffOfNewApplication(vendorName: string, applicationId: string): Promise<void> {
  const admins = await administrationRepository.listAllForNotification();
  for (const admin of admins) {
    await notificationsService.notify({
      recipientUserId: admin.userId,
      type: "ADMIN_NEW_MANUFACTURER_APPLICATION",
      title: "New manufacturer upgrade request",
      body: `"${vendorName}" has applied to add Manufacturer capability.`,
      targetUrl: notificationLinks.adminManufacturerApplication(applicationId),
      eventKey: `admin-new-manufacturer-application:${applicationId}`,
      email: {
        to: admin.user.email,
        subject: "New manufacturer upgrade request",
        templateKey: "admin-new-manufacturer-application",
        templateData: { vendorName, applicationId },
      },
    });
  }
}

export const manufacturerApplicationsService = {
  // --- Vendor (own application) -----------------------------------------

  getForVendor(vendorId: string) {
    return manufacturerApplicationsRepository.findForVendor(vendorId);
  },

  /**
   * Create (first submission) or edit-and-resubmit an existing application.
   * Mirrors beautyProfessionalsService.submitOrUpdate exactly: this is a
   * SHORT, single-step form (just what they manufacture — M32.8 §4 "reuse
   * information CrownSource already knows about their Vendor," so location
   * is never re-asked here), so there is no separate draft-save step —
   * submitting immediately (re)enters the review queue, same as Beauty
   * Professional's profile submission.
   */
  async submitOrUpdate(vendorId: string, input: CategoryStepInput): Promise<Result<{ status: string }>> {
    const normalized = normalizeCategorySelection(input);
    if (!normalized.ok) return normalized;

    const existing = await manufacturerApplicationsRepository.findForVendor(vendorId);

    if (!existing) {
      const created = await manufacturerApplicationsRepository.createAndSubmit(vendorId, normalized.value);
      await notifySubmitted(vendorId, created.id);
      return ok({ status: created.status });
    }

    if (existing.status === "SUBMITTED" || existing.status === "UNDER_REVIEW") {
      return err("Your manufacturer application is already awaiting review.");
    }
    if (existing.status === "APPROVED") {
      return err("Your manufacturer application has already been approved.");
    }

    // DRAFT (unused in practice — createAndSubmit always submits immediately)
    // / CHANGES_REQUESTED / REJECTED — (re)submit for review.
    const updated = await manufacturerApplicationsRepository.updateForVendor(vendorId, {
      ...normalized.value,
      status: "SUBMITTED",
      submittedAt: new Date(),
      decisionReason: null,
    });
    await notifySubmitted(vendorId, updated.id);
    return ok({ status: updated.status });
  },

  // --- Admin moderation -----------------------------------------------

  async listForAdminPaginated(statuses: string[] = REVIEWABLE_STATUSES, page = 1) {
    const { rows, total } = await manufacturerApplicationsRepository.listForAdminPaginated(statuses, page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  getForAdmin(applicationId: string) {
    return manufacturerApplicationsRepository.findById(applicationId);
  },

  async approve(adminUserId: string, applicationId: string): Promise<Result<null>> {
    const application = await manufacturerApplicationsRepository.findById(applicationId);
    if (!application) return err("Application not found.");
    if (await vendorsRepository.isMember(adminUserId, application.vendorId)) {
      return err("You cannot approve your own vendor's application.");
    }
    if (!REVIEWABLE_STATUSES.includes(application.status)) {
      return err("This application is not awaiting review.");
    }

    await manufacturerApplicationsRepository.approve(applicationId, adminUserId);
    await notifyVendorOwner({
      vendorId: application.vendorId,
      type: "MANUFACTURER_APPLICATION_APPROVED",
      title: "You're now a Manufacturer on CrownSource",
      body: `Your request to add Manufacturer capability for "${application.vendor.companyName}" has been approved.`,
      eventKey: `manufacturer-application-approved:${applicationId}`,
      emailTemplateKey: "manufacturer-application-approved",
      emailSubject: "Your manufacturer application was approved",
      emailData: { vendorName: application.vendor.companyName },
    });
    return ok(null);
  },

  async requestChanges(adminUserId: string, applicationId: string, reason: string): Promise<Result<null>> {
    const application = await manufacturerApplicationsRepository.findById(applicationId);
    if (!application) return err("Application not found.");
    if (await vendorsRepository.isMember(adminUserId, application.vendorId)) {
      return err("You cannot review your own vendor's application.");
    }
    if (!REVIEWABLE_STATUSES.includes(application.status)) {
      return err("This application is not awaiting review.");
    }
    await manufacturerApplicationsRepository.requestChanges(applicationId, adminUserId, reason);
    await notifyVendorOwner({
      vendorId: application.vendorId,
      type: "MANUFACTURER_APPLICATION_CHANGES_REQUESTED",
      title: "Changes requested on your manufacturer application",
      body: `CrownSourceGlobal has requested changes to your manufacturer application: ${reason}`,
      eventKey: `manufacturer-application-changes-requested:${applicationId}:${Date.now()}`,
      emailTemplateKey: "manufacturer-application-changes-requested",
      emailSubject: "Changes requested on your manufacturer application",
      emailData: { reason },
    });
    return ok(null);
  },

  async reject(adminUserId: string, applicationId: string, reason: string): Promise<Result<null>> {
    const application = await manufacturerApplicationsRepository.findById(applicationId);
    if (!application) return err("Application not found.");
    if (await vendorsRepository.isMember(adminUserId, application.vendorId)) {
      return err("You cannot review your own vendor's application.");
    }
    if (!REVIEWABLE_STATUSES.includes(application.status)) {
      return err("This application is not awaiting review.");
    }
    await manufacturerApplicationsRepository.reject(applicationId, adminUserId, reason);
    await notifyVendorOwner({
      vendorId: application.vendorId,
      type: "MANUFACTURER_APPLICATION_REJECTED",
      title: "Your manufacturer application was not approved",
      body: `Your manufacturer application was not approved: ${reason}`,
      eventKey: `manufacturer-application-rejected:${applicationId}:${Date.now()}`,
      emailTemplateKey: "manufacturer-application-rejected",
      emailSubject: "Your manufacturer application was not approved",
      emailData: { reason },
    });
    return ok(null);
  },
};
