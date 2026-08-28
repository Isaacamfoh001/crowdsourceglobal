import { beautyProfessionalsService } from "../../../../modules/beauty-professionals/service";
import { apiSuccess } from "../../../../lib/api/response";
import { toBeautyProfessionalSummaryDTO } from "../../../../lib/api/dto/beauty-professionals";

/**
 * GET /api/v1/beauty-professionals — public, unauthenticated (M22). Only
 * `status: APPROVED` profiles, newest-first, cursor-paginated (same
 * convention as GET /api/v1/explore-posts). `?category=<slug>` filters on
 * the professional's specialties, using the same shared beauty-category
 * taxonomy Explore already uses (see prisma/schema.prisma's
 * BeautyProfessionalProfile doc comment) — never a second category
 * universe/endpoint. `?q=<text>` does a simple case-insensitive
 * displayName search — no dedicated search infrastructure (MOBILE_V1_PLAN.md
 * §14: "do not build Elasticsearch/Algolia" for this scale).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const categorySlug = url.searchParams.get("category") ?? undefined;
  const search = url.searchParams.get("q") ?? undefined;
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const feed = await beautyProfessionalsService.getFeed({ categorySlug, search, cursor });

  return apiSuccess({ rows: feed.rows.map(toBeautyProfessionalSummaryDTO), nextCursor: feed.nextCursor });
}
