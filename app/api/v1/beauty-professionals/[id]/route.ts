import { beautyProfessionalsService } from "../../../../../modules/beauty-professionals/service";
import { apiError, apiSuccess } from "../../../../../lib/api/response";
import { toBeautyProfessionalDetailDTO } from "../../../../../lib/api/dto/beauty-professionals";

type Params = { id: string };

/**
 * GET /api/v1/beauty-professionals/[id] — public, unauthenticated (M22).
 * Full profile + offered services + portfolio (the professional's own
 * approved+published ExplorePost rows — see schema doc comment for why
 * this isn't a second photo system). Only resolves an `APPROVED` profile;
 * anything else 404s exactly like an unapproved listing/Explore post would.
 */
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const profile = await beautyProfessionalsService.getPublicDetail(id);
  if (!profile) return apiError("NOT_FOUND", "Professional not found.");
  return apiSuccess(toBeautyProfessionalDetailDTO(profile));
}
