import { serviceRequestsRepository } from "./repository";
import { beautyProfessionalsRepository } from "../beauty-professionals/repository";
import { beautyServicesRepository } from "../beauty-services/repository";
import { vendorsRepository } from "../vendors/repository";
import { notificationsService } from "../notifications/service";
import { notificationLinks } from "../notifications/links";
import { ok, err, type Result } from "../../lib/result";
import { DEFAULT_PAGE_SIZE } from "../../lib/pagination";
import { storageProvider, generateStorageKey } from "../../lib/storage";
import { validateServiceRequestImage } from "./image-validation";
import type { CreateServiceRequestInput, ServiceRequestView } from "./types";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
const MAX_QUANTITY = 20;

const IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

async function resolveReferenceImage(
  file: { buffer: Buffer; filename: string; mimeType: string } | null,
): Promise<Result<string | null>> {
  if (!file) return ok(null);
  const validation = validateServiceRequestImage({ mimeType: file.mimeType, sizeBytes: file.buffer.length, buffer: file.buffer });
  if (!validation.ok) return err(validation.error);
  try {
    const key = generateStorageKey("service-request-images", IMAGE_EXTENSION_BY_MIME_TYPE[file.mimeType] ?? "");
    await storageProvider.putObject({ key, buffer: file.buffer, contentType: file.mimeType });
    return ok(key);
  } catch (error) {
    console.error("Service request reference image upload failed:", error);
    return err("Something went wrong uploading your reference photo. Please try again.");
  }
}

export const serviceRequestsService = {
  /**
   * Customer submits a structured request for one service from one public,
   * APPROVED professional (M22 §12). Validates the service actually belongs
   * to that professional and is currently active/offered, that the chosen
   * location mode is one the professional actually supports, and that the
   * preferred date is not in the past. No payment/escrow/scheduling here —
   * see prisma/schema.prisma's section header.
   */
  async create(
    customerUserId: string,
    input: CreateServiceRequestInput,
    referenceImageFile: { buffer: Buffer; filename: string; mimeType: string } | null = null,
  ): Promise<Result<{ id: string }>> {
    const professional = await beautyProfessionalsRepository.findApprovedForRequest(input.professionalId);
    if (!professional) return err("This professional is not available for requests.");

    const service = await beautyServicesRepository.findForProfile(input.professionalId, input.serviceId);
    if (!service || !service.active) return err("This service is not currently available.");

    if (professional.locationMode !== "BOTH" && professional.locationMode !== input.locationMode) {
      return err("This professional does not support that service location.");
    }

    const preferredDate = new Date(input.preferredDate);
    if (Number.isNaN(preferredDate.getTime())) return err("Choose a valid preferred date.");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (preferredDate < startOfToday) return err("Preferred date can't be in the past.");

    const quantity = input.quantity && input.quantity > 0 ? Math.min(input.quantity, MAX_QUANTITY) : 1;

    const imageResult = await resolveReferenceImage(referenceImageFile);
    if (!imageResult.ok) return imageResult;

    const request = await serviceRequestsRepository.create(customerUserId, {
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      preferredDate,
      preferredTimeNote: input.preferredTimeNote?.trim() || null,
      locationMode: input.locationMode,
      locationDetails: input.locationDetails?.trim() || null,
      notes: input.notes?.trim() || null,
      quantity,
      referenceImage: imageResult.value,
    });

    const owner = await vendorsRepository.findOwnerUserIdAndEmail(professional.vendorId);
    if (owner) {
      await notificationsService.notify({
        recipientUserId: owner.userId,
        type: "SERVICE_REQUEST_SUBMITTED",
        title: "New service request",
        body: `A customer requested ${service.name}.`,
        targetUrl: notificationLinks.vendorServiceRequest(request.id),
        eventKey: `service-request-submitted:${request.id}`,
        email: {
          to: owner.email,
          subject: "New CrownSourceGlobal service request",
          templateKey: "service-request-submitted",
          templateData: { serviceName: service.name },
        },
      });
    }

    return ok({ id: request.id });
  },

  // --- Customer ------------------------------------------------------

  async listForCustomer(customerUserId: string, page: number) {
    const { rows, total } = await serviceRequestsRepository.findForCustomerPaginated(customerUserId, page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  getForCustomer(customerUserId: string, id: string) {
    return serviceRequestsRepository.findForCustomer(customerUserId, id);
  },

  async cancel(customerUserId: string, id: string): Promise<Result<null>> {
    const cancelled = await serviceRequestsRepository.cancelForCustomer(customerUserId, id);
    return cancelled ? ok(null) : err("Only a request still awaiting a response can be cancelled.");
  },

  // --- Provider --------------------------------------------------------

  async listForProfessional(professionalId: string, page: number) {
    const { rows, total } = await serviceRequestsRepository.findForProfessionalPaginated(professionalId, page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  getForProfessional(professionalId: string, id: string) {
    return serviceRequestsRepository.findForProfessional(professionalId, id);
  },

  async accept(professionalId: string, id: string): Promise<Result<null>> {
    const request = await serviceRequestsRepository.findForProfessional(professionalId, id);
    if (!request) return err("Request not found.");
    const accepted = await serviceRequestsRepository.acceptForProfessional(professionalId, id);
    if (!accepted) return err("This request has already been responded to.");
    await notifyCustomer(request, "SERVICE_REQUEST_ACCEPTED", "Your service request was accepted", `${request.professional.name} accepted your request for ${request.service.name}.`);
    return ok(null);
  },

  async decline(professionalId: string, id: string, reason: string | null): Promise<Result<null>> {
    const request = await serviceRequestsRepository.findForProfessional(professionalId, id);
    if (!request) return err("Request not found.");
    const declined = await serviceRequestsRepository.declineForProfessional(professionalId, id, reason);
    if (!declined) return err("This request has already been responded to.");
    await notifyCustomer(
      request,
      "SERVICE_REQUEST_DECLINED",
      "Your service request was declined",
      `${request.professional.name} is unable to take your request for ${request.service.name}${reason ? `: ${reason}` : "."}`,
    );
    return ok(null);
  },

  // --- Admin (read-only operational visibility) ---------------------------

  async listForAdmin(page: number) {
    const { rows, total } = await serviceRequestsRepository.findAllForAdminPaginated(page, PAGE_SIZE);
    return { rows, total, pageSize: PAGE_SIZE };
  },

  getForAdmin(id: string) {
    return serviceRequestsRepository.findForAdmin(id);
  },
};

async function notifyCustomer(
  request: ServiceRequestView,
  type: "SERVICE_REQUEST_ACCEPTED" | "SERVICE_REQUEST_DECLINED",
  title: string,
  body: string,
): Promise<void> {
  const contact = await serviceRequestsRepository.findCustomerContact(request.customer.id);
  if (!contact) return;
  await notificationsService.notify({
    recipientUserId: request.customer.id,
    type,
    title,
    body,
    targetUrl: notificationLinks.customerServiceRequest(request.id),
    eventKey: `${type.toLowerCase().replace(/_/g, "-")}:${request.id}`,
    email: { to: contact.email, subject: title, templateKey: type === "SERVICE_REQUEST_ACCEPTED" ? "service-request-accepted" : "service-request-declined", templateData: { reason: request.declineReason } },
  });
}
