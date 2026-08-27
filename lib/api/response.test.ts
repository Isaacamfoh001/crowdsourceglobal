import { describe, expect, it } from "vitest";
import { Prisma } from "../../generated/prisma/client";
import { apiError, apiPage, apiSuccess, serializeDate, serializeMoney } from "./response";

describe("lib/api/response — shared /api/v1 conventions", () => {
  it("wraps success payloads as { data }", async () => {
    const response = apiSuccess({ hello: "world" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { hello: "world" } });
  });

  it("shapes an error as { error: { code, message } } with the status derived from the code", async () => {
    const response = apiError("UNAUTHORIZED", "Authentication required.");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  });

  it("maps every error code to its expected HTTP status", async () => {
    expect(apiError("FORBIDDEN", "x").status).toBe(403);
    expect(apiError("NOT_FOUND", "x").status).toBe(404);
    expect(apiError("VALIDATION_ERROR", "x").status).toBe(422);
    expect(apiError("INTERNAL_ERROR", "x").status).toBe(500);
  });

  it("serializes money as a fixed 2-decimal string, never a JS float, from a Prisma Decimal", () => {
    expect(serializeMoney(new Prisma.Decimal("4600"), "GHS")).toEqual({ amount: "4600.00", currency: "GHS" });
    expect(serializeMoney(new Prisma.Decimal("99.999"), "GHS")).toEqual({ amount: "100.00", currency: "GHS" });
  });

  it("serializes money the same way from a plain number/string", () => {
    expect(serializeMoney(4600, "GHS")).toEqual({ amount: "4600.00", currency: "GHS" });
    expect(serializeMoney("15.5", "GHS")).toEqual({ amount: "15.50", currency: "GHS" });
  });

  it("serializes dates as ISO-8601 strings", () => {
    const date = new Date("2026-08-27T12:00:00.000Z");
    expect(serializeDate(date)).toBe("2026-08-27T12:00:00.000Z");
  });

  it("shapes a paginated result using the existing page/pageSize/total convention", () => {
    expect(apiPage({ rows: [1, 2], total: 5, page: 1, pageSize: 2 })).toEqual({
      page: 1,
      pageSize: 2,
      total: 5,
      rows: [1, 2],
    });
  });
});
