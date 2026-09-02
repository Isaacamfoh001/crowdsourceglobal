import { z } from "zod";
import { getCurrentSession } from "../../../../../../../modules/identity/policy";
import { resolveVendorContext } from "../../../../../../../lib/api/vendor-context";
import { beautyServicesService } from "../../../../../../../modules/beauty-services/service";
import { apiError, apiSuccess } from "../../../../../../../lib/api/response";

type Params = { id: string };

const schema = z.object({
  name: z.string().trim().min(2, "Enter a service name."),
  description: z.string().trim().optional(),
  categoryId: z.string().trim().min(1, "Choose a category."),
  startingPrice: z.string().trim().optional(),
  currency: z.string().trim().optional(),
});

/** PATCH /api/v1/vendor/beauty-professional/services/:id (M27) — edit an offered service. */
export async function PATCH(request: Request, { params }: { params: Promise<Params> }) {
  const session = await getCurrentSession();
  if (!session) return apiError("UNAUTHORIZED", "Authentication required.");

  const context = await resolveVendorContext(session.user.id);
  if (!context) return apiError("FORBIDDEN", "This account is not an approved vendor.");

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected a JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Check the service details.");

  const result = await beautyServicesService.update(context.vendorId, id, parsed.data);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);
  return apiSuccess(null);
}
