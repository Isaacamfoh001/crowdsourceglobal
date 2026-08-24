"use server";

import { revalidatePath } from "next/cache";
import { requireAdminSession } from "../../modules/administration/policy";
import { talentService } from "../../modules/talent/service";
import { checkActionRateLimit, RATE_LIMIT_MESSAGE } from "../rate-limit";
import { resolveClientIp } from "../request-ip";
import { err, type Result } from "../result";
import type {
  TalentApplicationStatus,
  TalentAvailability,
  TalentCloseOutcome,
  TalentExperienceLevel,
  TalentOpportunityType,
  TalentSkill,
  TalentWorkStatus,
} from "../../modules/talent/types";

const ADMIN_OPS_ROLES = ["SUPER_ADMIN", "OPS_ADMIN"] as const;

// Guest submissions are unauthenticated and public — a generous but real
// ceiling per IP protects against obvious abuse without risking blocking a
// legitimate applicant who retries after fixing a validation error.
const SUBMIT_RATE_LIMIT = { windowSeconds: 60 * 60, max: 5 };

// --- Public / guest ------------------------------------------------------

export async function submitTalentApplicationAction(
  _prevState: Result<{ applicationNumber: string }> | null,
  formData: FormData,
): Promise<Result<{ applicationNumber: string }>> {
  const rateLimit = await checkActionRateLimit(`talent-application:${await resolveClientIp()}`, SUBMIT_RATE_LIMIT);
  if (!rateLimit.allowed) return err(RATE_LIMIT_MESSAGE);

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

  const result = await talentService.submitApplication(
    {
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
      willingToRelocate: formData.get("willingToRelocate") === "on",
      preferredWorkLocation: String(formData.get("preferredWorkLocation") ?? "") || undefined,
      statement: String(formData.get("statement") ?? ""),
      portfolioUrl: String(formData.get("portfolioUrl") ?? "") || undefined,
      ownershipConfirmed: formData.get("ownershipConfirmed") === "on",
    },
    files,
  );

  return result;
}

// --- Admin/staff -----------------------------------------------------------

export async function transitionTalentApplicationAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { admin } = await requireAdminSession("/admin/talent", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "") as TalentApplicationStatus;
  const closeOutcomeRaw = String(formData.get("closeOutcome") ?? "");
  const closeOutcome = closeOutcomeRaw ? (closeOutcomeRaw as TalentCloseOutcome) : undefined;

  const result = await talentService.transitionStatus(id, admin.id, nextStatus, closeOutcome);
  if (result.ok) revalidatePath(`/admin/talent/${id}`);
  return result;
}

export async function addTalentApplicationNoteAction(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const { admin } = await requireAdminSession("/admin/talent", [...ADMIN_OPS_ROLES]);
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "");

  const result = await talentService.addInternalNote(id, admin.id, note);
  if (result.ok) revalidatePath(`/admin/talent/${id}`);
  return result;
}
