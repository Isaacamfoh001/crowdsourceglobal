import { absoluteServiceRequestImageUrl } from "../images";
import { serializeDate } from "../response";
import type { ServiceRequestView } from "../../../modules/service-requests/types";

/** Customer-facing DTO — never includes the professional's private Vendor contact fields (CrownSource remains the intermediary, M22 §12). */
export function toServiceRequestDTO(request: ServiceRequestView) {
  return {
    id: request.id,
    status: request.status,
    preferredDate: serializeDate(request.preferredDate),
    preferredTimeNote: request.preferredTimeNote,
    locationMode: request.locationMode,
    locationDetails: request.locationDetails,
    notes: request.notes,
    quantity: request.quantity,
    referenceImage: request.referenceImage ? absoluteServiceRequestImageUrl(request.referenceImage) : null,
    declineReason: request.declineReason,
    createdAt: serializeDate(request.createdAt),
    updatedAt: serializeDate(request.updatedAt),
    professional: request.professional,
    service: request.service,
  };
}
