// @vitest-environment node
import { describe, expect, it } from "vitest";
import { GET } from "./route";

/**
 * Public, unauthenticated endpoint — no session/identity mocking at all in
 * this file, unlike app/api/v1/me/*.test.ts. That absence IS the test: a
 * request with no Authorization header at all must still succeed.
 */
describe("GET /api/v1/categories", () => {
  function request() {
    return new Request("http://localhost/api/v1/categories");
  }

  it("succeeds with no Authorization header", async () => {
    const req = request();
    expect(req.headers.get("authorization")).toBeNull();

    const response = await GET(req);
    expect(response.status).toBe(200);
  });

  it("returns the canonical top-level taxonomy with children, matching the web homepage/Shop nav", async () => {
    const response = await GET(request());
    const body = await response.json();

    const hairWigs = body.data.categories.find((c: { slug: string }) => c.slug === "hair-wigs");
    expect(hairWigs).toBeDefined();
    expect(hairWigs.parentCategoryId).toBeNull();
    expect(Array.isArray(hairWigs.children)).toBe(true);
    expect(hairWigs.children.some((child: { slug: string }) => child.slug === "wigs")).toBe(true);
  });

  it("returns only the deliberate DTO fields", async () => {
    const response = await GET(request());
    const body = await response.json();
    const [category] = body.data.categories;

    expect(Object.keys(category).sort()).toEqual(["children", "id", "name", "parentCategoryId", "slug"]);
    if (category.children.length > 0) {
      // A child is a plain category — it does not itself carry a nested "children" array.
      expect(Object.keys(category.children[0]).sort()).toEqual(["id", "name", "parentCategoryId", "slug"]);
    }
  });
});
