import { talentService } from "../../../../modules/talent/service";
import { apiError, apiSuccess } from "../../../../lib/api/response";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../../../../lib/rate-limit";
import type {
  TalentApplicationInput,
  TalentAvailability,
  TalentExperienceLevel,
  TalentOpportunityType,
  TalentSkill,
  TalentWorkStatus,
} from "../../../../modules/talent/types";

// Guest submissions are unauthenticated and public — same ceiling as the
// existing web guest form's server action (lib/actions/talent.ts) so a
// mobile applicant and a web applicant share one fair, IP-scoped limit
// rather than the mobile client getting its own separate allowance.
const SUBMIT_RATE_LIMIT = { windowSeconds: 60 * 60, max: 5 };

/**
 * Same header-preference logic as lib/request-ip.ts's resolveClientIp, but
 * reads directly off the Route Handler's own `Request` instead of
 * `next/headers`'s `headers()` — that helper requires Next's request-scope
 * async storage, which a Route Handler's `Request` doesn't need and which
 * made this untestable by calling `POST()` directly.
 */
function resolveIpFromRequest(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const leftmost = forwardedFor.split(",")[0]?.trim();
    if (leftmost) return leftmost;
  }

  return "unknown";
}

/**
 * POST /api/v1/talent-applications (M23.2) — Careers / Talent Network.
 * Guest-accessible, same as the web `/careers/apply` flow: no session, no
 * userId anywhere in the call, and no linking to an authenticated User —
 * this mirrors the existing M15 business rule rather than inventing a new
 * one for mobile (see modules/talent/service.ts's doc comment). Calls the
 * exact same `talentService.submitApplication` the web form calls — no
 * duplicated business logic.
 *
 * `multipart/form-data`: fullName, phone, email?, city, region?,
 * currentWorkStatus, experienceLevel, availability, skills[] (repeat
 * field), otherSkillDescription?, opportunityTypes[] (repeat field),
 * willingToRelocate ("true"/"false"), preferredWorkLocation?, statement?,
 * portfolioLinks[] (repeat field, up to 3 http(s) URLs),
 * ownershipConfirmed ("true"/"false"), plus 3-8 `workSamplePhotos` file
 * parts (PNG/JPEG/WEBP, <=5MB each) with optional parallel
 * `workSampleCaptions` string parts.
 */
export async function POST(request: Request) {
  const rateLimit = await checkActionRateLimit(`talent-application-api:${resolveIpFromRequest(request)}`, SUBMIT_RATE_LIMIT);
  if (!rateLimit.allowed) return apiError("RATE_LIMITED", RATE_LIMIT_MESSAGE);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Expected multipart/form-data.");
  }

  const files: { buffer: Buffer; filename: string; mimeType: string; caption?: string }[] = [];
  const photoEntries = formData.getAll("workSamplePhotos");
  const captionEntries = formData.getAll("workSampleCaptions").map(String);
  for (let i = 0; i < photoEntries.length; i += 1) {
    const entry = photoEntries[i];
    if (entry instanceof File && entry.size > 0) {
      files.push({
        buffer: Buffer.from(await entry.arrayBuffer()),
        filename: entry.name,
        mimeType: entry.type,
        caption: captionEntries[i] || undefined,
      });
    }
  }

  const input: TalentApplicationInput = {
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? "") || undefined,
    city: String(formData.get("city") ?? ""),
    region: String(formData.get("region") ?? "") || undefined,
    currentWorkStatus: String(formData.get("currentWorkStatus") ?? "") as TalentWorkStatus,
    experienceLevel: String(formData.get("experienceLevel") ?? "") as TalentExperienceLevel,
    availability: String(formData.get("availability") ?? "") as TalentAvailability,
    skills: formData.getAll("skills").map(String) as TalentSkill[],
    otherSkillDescription: String(formData.get("otherSkillDescription") ?? "") || undefined,
    opportunityTypes: formData.getAll("opportunityTypes").map(String) as TalentOpportunityType[],
    willingToRelocate: String(formData.get("willingToRelocate") ?? "") === "true",
    preferredWorkLocation: String(formData.get("preferredWorkLocation") ?? "") || undefined,
    statement: String(formData.get("statement") ?? "") || undefined,
    portfolioLinks: formData.getAll("portfolioLinks").map(String).filter(Boolean),
    ownershipConfirmed: String(formData.get("ownershipConfirmed") ?? "") === "true",
  };

  const result = await talentService.submitApplication(input, files);
  if (!result.ok) return apiError("VALIDATION_ERROR", result.error);

  return apiSuccess({ applicationNumber: result.value.applicationNumber }, { status: 201 });
}
