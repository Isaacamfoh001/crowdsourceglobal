// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../../lib/db";
import { POST } from "./route";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const NOT_AN_IMAGE = Buffer.from("this is not an image");

function pngFile(name: string) {
  return new File([PNG_MAGIC], name, { type: "image/png" });
}

let ipCounter = 0;

function postRequest(fields: Record<string, string | string[]>, photoCount = 3, extraFiles: File[] = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) value.forEach((v) => form.append(key, v));
    else form.set(key, value);
  }
  for (let i = 0; i < photoCount; i += 1) form.append("workSamplePhotos", pngFile(`sample-${i}.png`));
  for (const file of extraFiles) form.append("workSamplePhotos", file);
  ipCounter += 1;
  // Each test uses a distinct synthetic IP so they don't share a rate-limit
  // bucket with each other or with previous runs of this suite.
  return new Request("http://localhost/api/v1/talent-applications", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": `203.0.113.${ipCounter}-${Date.now()}` },
  });
}

const validFields = {
  fullName: "Ama Mobile Applicant",
  phone: "0244111222",
  city: "Accra",
  currentWorkStatus: "FREELANCE_SELF_EMPLOYED",
  experienceLevel: "ONE_TO_TWO_YEARS",
  availability: "IMMEDIATELY",
  skills: ["BRAIDING"],
  opportunityTypes: ["FULL_TIME"],
  willingToRelocate: "false",
  statement: "I've been braiding for about two years.",
  ownershipConfirmed: "true",
};

describe("POST /api/v1/talent-applications", () => {
  const createdApplicationNumbers: string[] = [];

  afterAll(async () => {
    await prisma.talentApplication.deleteMany({ where: { applicationNumber: { in: createdApplicationNumbers } } });
    await prisma.$disconnect();
  });

  it("accepts a guest submission with no session/auth header involved", async () => {
    const response = await POST(postRequest(validFields));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.applicationNumber).toMatch(/^TAL-\d{8}-[A-Z0-9]{5}$/);
    createdApplicationNumbers.push(body.data.applicationNumber);
  });

  it("accepts up to 3 work/portfolio links", async () => {
    const response = await POST(
      postRequest({ ...validFields, portfolioLinks: ["https://instagram.com/x", "https://tiktok.com/@x"] }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    createdApplicationNumbers.push(body.data.applicationNumber);
  });

  it("rejects an invalid work/portfolio link", async () => {
    const response = await POST(postRequest({ ...validFields, portfolioLinks: ["not-a-url"] }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects fewer than 3 work sample photos", async () => {
    const response = await POST(postRequest(validFields, 2));
    expect(response.status).toBe(422);
  });

  it("rejects missing required fields", async () => {
    const response = await POST(postRequest({ ...validFields, fullName: "" }));
    expect(response.status).toBe(422);
  });

  it("accepts a submission with no statement (M23.3 — statement is optional)", async () => {
    const { statement: _omit, ...withoutStatement } = validFields;
    const response = await POST(postRequest(withoutStatement));
    expect(response.status).toBe(201);
    const body = await response.json();
    createdApplicationNumbers.push(body.data.applicationNumber);
  });

  it("rejects an image whose bytes don't match its claimed type — as a normal JSON error response, never a thrown/hung request", async () => {
    const badFile = new File([NOT_AN_IMAGE], "fake.png", { type: "image/png" });
    const response = await POST(postRequest(validFields, 2, [badFile]));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts exactly 4 work sample photos (mid-range multi-file count)", async () => {
    const response = await POST(postRequest(validFields, 4));
    expect(response.status).toBe(201);
    const body = await response.json();
    createdApplicationNumbers.push(body.data.applicationNumber);
  });

  it("accepts the maximum of 8 work sample photos, all persisted (M23.4 — real multi-file multipart)", async () => {
    const response = await POST(postRequest(validFields, 8));
    expect(response.status).toBe(201);
    const body = await response.json();
    createdApplicationNumbers.push(body.data.applicationNumber);

    const application = await prisma.talentApplication.findUnique({
      where: { applicationNumber: body.data.applicationNumber },
      include: { workSamples: true },
    });
    expect(application?.workSamples).toHaveLength(8);
    // Each part must have landed as its own distinct file, not one
    // collapsed/duplicated/malformed part.
    const uniqueStorageKeys = new Set(application?.workSamples.map((s) => s.storageKey));
    expect(uniqueStorageKeys.size).toBe(8);
  });

  it("rejects more than 8 work sample photos", async () => {
    const response = await POST(postRequest(validFields, 9));
    expect(response.status).toBe(422);
  });
});
