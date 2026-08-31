import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { talentService } from "./service";
import type { TalentApplicationInput, TalentWorkSampleInput } from "./types";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const NOT_AN_IMAGE = Buffer.from("this is not an image");

function validPhoto(name = "work.png"): TalentWorkSampleInput {
  return { buffer: PNG_MAGIC, filename: name, mimeType: "image/png" };
}

function threeValidPhotos(): TalentWorkSampleInput[] {
  return [validPhoto("a.png"), validPhoto("b.png"), validPhoto("c.png")];
}

const baseInput: TalentApplicationInput = {
  fullName: "Ama Applicant",
  phone: "0244111222",
  city: "Accra",
  currentWorkStatus: "FREELANCE_SELF_EMPLOYED",
  experienceLevel: "ONE_TO_TWO_YEARS",
  availability: "IMMEDIATELY",
  skills: ["BRAIDING", "WIG_INSTALLATION"],
  opportunityTypes: ["FULL_TIME", "OPEN_TO_ANY"],
  willingToRelocate: false,
  statement: "I've been braiding and installing wigs for about two years.",
  ownershipConfirmed: true,
};

/** Integration tests against the real local Postgres dev database — same conventions as modules/sourcing/service.test.ts. */
describe("talentService", () => {
  const createdApplicationIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdAdminIds: string[] = [];
  let adminId: string;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: { id: `m15-admin-${suffix}`, name: "Staff Reviewer", email: `m15.staff.${suffix}@example.com` },
    });
    createdUserIds.push(user.id);
    const admin = await prisma.adminUser.create({ data: { userId: user.id, role: "OPS_ADMIN" } });
    createdAdminIds.push(admin.id);
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.talentApplication.deleteMany({ where: { id: { in: createdApplicationIds } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: createdAdminIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  async function submit(overrides: Partial<TalentApplicationInput> = {}, files = threeValidPhotos()) {
    const result = await talentService.submitApplication({ ...baseInput, ...overrides }, files);
    if (result.ok) createdApplicationIds.push(result.value.id);
    return result;
  }

  // --- Public / guest submission ------------------------------------------

  it("accepts a valid guest submission with no session/userId involved anywhere in the call", async () => {
    const result = await submit();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.applicationNumber).toMatch(/^TAL-\d{8}-[A-Z0-9]{5}$/);
  });

  it("requires full name, phone, and city", async () => {
    expect((await submit({ fullName: "" })).ok).toBe(false);
    expect((await submit({ phone: "" })).ok).toBe(false);
    expect((await submit({ city: "" })).ok).toBe(false);
  });

  it("requires at least one skill", async () => {
    const result = await submit({ skills: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/skill/i);
  });

  it("requires an explanation when the OTHER skill is selected", async () => {
    const withoutDescription = await submit({ skills: ["OTHER"] });
    expect(withoutDescription.ok).toBe(false);

    const withDescription = await submit({ skills: ["OTHER"], otherSkillDescription: "Bridal hairstyling" });
    expect(withDescription.ok).toBe(true);
  });

  it("requires at least one opportunity type", async () => {
    const result = await submit({ opportunityTypes: [] });
    expect(result.ok).toBe(false);
  });

  it("requires ownership confirmation before submission", async () => {
    const result = await submit({ ownershipConfirmed: false });
    expect(result.ok).toBe(false);
  });

  it("accepts a submission with no statement (M23.3 — statement is optional)", async () => {
    const result = await submit({ statement: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = await talentService.getForAdmin(result.value.id);
    expect(detail?.statement).toBeNull();
  });

  it("treats a blank/whitespace-only statement the same as no statement", async () => {
    const result = await submit({ statement: "   " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = await talentService.getForAdmin(result.value.id);
    expect(detail?.statement).toBeNull();
  });

  it("still enforces the statement max length when one is provided", async () => {
    const result = await submit({ statement: "x".repeat(751) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/750 characters/i);
  });

  it("rejects an invalid portfolio URL but accepts a valid one", async () => {
    const invalid = await submit({ portfolioUrl: "not a url" });
    expect(invalid.ok).toBe(false);

    const valid = await submit({ portfolioUrl: "https://instagram.com/amasbraids" });
    expect(valid.ok).toBe(true);
  });

  it("accepts up to 3 valid work/portfolio links", async () => {
    const result = await submit({
      portfolioLinks: ["https://instagram.com/amasbraids", "https://tiktok.com/@amasbraids", "https://amasbraids.com"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = await talentService.getForAdmin(result.value.id);
    expect(detail?.portfolioLinks).toEqual([
      "https://instagram.com/amasbraids",
      "https://tiktok.com/@amasbraids",
      "https://amasbraids.com",
    ]);
  });

  it("rejects more than 3 work/portfolio links", async () => {
    const result = await submit({
      portfolioLinks: ["https://a.example.com", "https://b.example.com", "https://c.example.com", "https://d.example.com"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/up to 3/i);
  });

  it("rejects an invalid work/portfolio link", async () => {
    const result = await submit({ portfolioLinks: ["not a url"] });
    expect(result.ok).toBe(false);
  });

  it("falls back to the legacy single portfolioUrl for admin display when portfolioLinks is empty", async () => {
    const result = await submit({ portfolioUrl: "https://instagram.com/amasbraids", portfolioLinks: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const detail = await talentService.getForAdmin(result.value.id);
    expect(detail?.portfolioLinks).toEqual(["https://instagram.com/amasbraids"]);
  });

  it("enforces a minimum of 3 work sample photos", async () => {
    const result = await submit({}, [validPhoto("a.png"), validPhoto("b.png")]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at least 3/i);
  });

  it("enforces a maximum of 8 work sample photos", async () => {
    const nine = Array.from({ length: 9 }, (_, i) => validPhoto(`photo-${i}.png`));
    const result = await submit({}, nine);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/up to 8/i);
  });

  it("rejects an upload that doesn't match its claimed image type", async () => {
    const badFile: TalentWorkSampleInput = { buffer: NOT_AN_IMAGE, filename: "fake.png", mimeType: "image/png" };
    const result = await submit({}, [validPhoto(), validPhoto("b.png"), badFile]);
    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported file type", async () => {
    const pdf: TalentWorkSampleInput = { buffer: Buffer.from("%PDF-1.4"), filename: "cv.pdf", mimeType: "application/pdf" };
    const result = await submit({}, [validPhoto(), validPhoto("b.png"), pdf]);
    expect(result.ok).toBe(false);
  });

  it("stores skills and work samples correctly, retrievable via the admin view", async () => {
    const result = await submit({ skills: ["MAKEUP_ARTISTRY", "LASH_EXTENSIONS"] }, [
      { ...validPhoto("a.png"), caption: "Bridal makeup" },
      validPhoto("b.png"),
      validPhoto("c.png"),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const detail = await talentService.getForAdmin(result.value.id);
    expect(detail).not.toBeNull();
    expect(detail?.skills.sort()).toEqual(["LASH_EXTENSIONS", "MAKEUP_ARTISTRY"].sort());
    expect(detail?.workSamples).toHaveLength(3);
    expect(detail?.workSamples.some((s) => s.caption === "Bridal makeup")).toBe(true);
    expect(detail?.status).toBe("NEW");
  });

  // --- Admin/staff ---------------------------------------------------------

  it("lists applications newest-first with pagination", async () => {
    const first = await submit();
    await new Promise((r) => setTimeout(r, 5));
    const second = await submit();
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    const { rows, total } = await talentService.listForAdminPaginated({}, 1);
    expect(total).toBeGreaterThanOrEqual(2);
    const firstIndex = rows.findIndex((r) => r.id === first.value.id);
    const secondIndex = rows.findIndex((r) => r.id === second.value.id);
    // second was submitted after first, so it must sort earlier (newest first).
    expect(secondIndex).toBeGreaterThanOrEqual(0);
    if (firstIndex >= 0) expect(secondIndex).toBeLessThan(firstIndex);
  });

  it("filters the admin list by status", async () => {
    const application = await submit();
    expect(application.ok).toBe(true);
    if (!application.ok) return;

    await talentService.transitionStatus(application.value.id, adminId, "REVIEWING");

    const reviewing = await talentService.listForAdminPaginated({ status: "REVIEWING" }, 1);
    expect(reviewing.rows.some((r) => r.id === application.value.id)).toBe(true);

    const newOnly = await talentService.listForAdminPaginated({ status: "NEW" }, 1);
    expect(newOnly.rows.some((r) => r.id === application.value.id)).toBe(false);
  });

  it("filters the admin list by skill", async () => {
    const application = await submit({ skills: ["NAIL_TECHNOLOGY"] });
    expect(application.ok).toBe(true);
    if (!application.ok) return;

    const matching = await talentService.listForAdminPaginated({ skill: "NAIL_TECHNOLOGY" }, 1);
    expect(matching.rows.some((r) => r.id === application.value.id)).toBe(true);

    const nonMatching = await talentService.listForAdminPaginated({ skill: "BARBERING" }, 1);
    expect(nonMatching.rows.some((r) => r.id === application.value.id)).toBe(false);
  });

  it("only allows the approved sequential status transitions", async () => {
    const application = await submit();
    expect(application.ok).toBe(true);
    if (!application.ok) return;
    const id = application.value.id;

    // NEW -> SHORTLISTED is not a valid direct transition.
    const invalid = await talentService.transitionStatus(id, adminId, "SHORTLISTED");
    expect(invalid.ok).toBe(false);

    const toReviewing = await talentService.transitionStatus(id, adminId, "REVIEWING");
    expect(toReviewing.ok).toBe(true);

    const toShortlisted = await talentService.transitionStatus(id, adminId, "SHORTLISTED");
    expect(toShortlisted.ok).toBe(true);

    const toReferred = await talentService.transitionStatus(id, adminId, "REFERRED");
    expect(toReferred.ok).toBe(true);

    const toClosed = await talentService.transitionStatus(id, adminId, "CLOSED", "PLACED");
    expect(toClosed.ok).toBe(true);

    const detail = await talentService.getForAdmin(id);
    expect(detail?.status).toBe("CLOSED");
    expect(detail?.closeOutcome).toBe("PLACED");
    expect(detail?.statusUpdatedByName).toBe("Staff Reviewer");

    // CLOSED has no further valid transitions.
    const afterClosed = await talentService.transitionStatus(id, adminId, "REVIEWING");
    expect(afterClosed.ok).toBe(false);
  });

  it("stores internal notes with author attribution, staff-only (never part of the guest-facing submission surface)", async () => {
    const application = await submit();
    expect(application.ok).toBe(true);
    if (!application.ok) return;

    const noted = await talentService.addInternalNote(application.value.id, adminId, "Strong portfolio, follow up.");
    expect(noted.ok).toBe(true);

    const detail = await talentService.getForAdmin(application.value.id);
    expect(detail?.notes).toHaveLength(1);
    expect(detail?.notes[0]?.note).toBe("Strong portfolio, follow up.");
    expect(detail?.notes[0]?.authorName).toBe("Staff Reviewer");
  });

  it("rejects an empty internal note", async () => {
    const application = await submit();
    expect(application.ok).toBe(true);
    if (!application.ok) return;
    const result = await talentService.addInternalNote(application.value.id, adminId, "   ");
    expect(result.ok).toBe(false);
  });

  it("keeps closed applications fully readable for audit", async () => {
    const application = await submit();
    expect(application.ok).toBe(true);
    if (!application.ok) return;
    await talentService.transitionStatus(application.value.id, adminId, "REVIEWING");
    await talentService.transitionStatus(application.value.id, adminId, "SHORTLISTED");
    await talentService.transitionStatus(application.value.id, adminId, "CLOSED", "NOT_SELECTED");

    const detail = await talentService.getForAdmin(application.value.id);
    expect(detail).not.toBeNull();
    expect(detail?.status).toBe("CLOSED");
    expect(detail?.fullName).toBe(baseInput.fullName);
  });
});
