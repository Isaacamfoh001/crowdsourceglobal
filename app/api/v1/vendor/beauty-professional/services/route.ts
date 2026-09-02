import { z } from "zod";
import { getCurrentSession } from "../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../lib/api/vendor-context";
import { beautyServicesService } from "../../../../../../modules/beauty-services/service";
import { toVendorServiceDTO } from "../../../../../../lib/api/dto/vendor";
import { apiError, apiSuccess } from "../../../../../../lib/api/response";

/** GET /api/v1/vendor/beauty-professional/services (M27) — this vendor's offered services. */
export async function GET() {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const services = await beautyServicesService.listForVendor(context.vendorId);
  return apiSuccess(services.map(toVendorServiceDTO));
}

const schema = z.object({
  name: z.string().trim().min(2, "Enter a service name."),
  description: z.string().trim().optional(),
  categoryId: z.string().trim().min(1, "Choose a category."),
  startingPrice: z.string().trim().optional(),
  currency: z.string().trim().optional(),
});

/** POST /api/v1/vendor/beauty-professional/services (M27) — add a service to the vendor's Beauty Professional profile. */
export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check the service details.");

  const result = await beautyServicesService.create(context.vendorId, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(toVendorServiceDTO(result.value), { status: 201 });
}
