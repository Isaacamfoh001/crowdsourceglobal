import { describe, expect, it } from "vitest";
import { normalizeGhanaPhone, maskGhanaPhone } from "./phone";

describe("normalizeGhanaPhone", () => {
  it("accepts an already-local 0-prefixed number", () => {
    expect(normalizeGhanaPhone("0244123456")).toBe("0244123456");
  });

  it("accepts a +233-prefixed number and normalizes to local format", () => {
    expect(normalizeGhanaPhone("+233244123456")).toBe("0244123456");
  });

  it("accepts a 233-prefixed number without the plus", () => {
    expect(normalizeGhanaPhone("233244123456")).toBe("0244123456");
  });

  it("accepts a 9-digit number without any prefix", () => {
    expect(normalizeGhanaPhone("244123456")).toBe("0244123456");
  });

  it("strips spaces and dashes before normalizing", () => {
    expect(normalizeGhanaPhone("024-412-3456")).toBe("0244123456");
    expect(normalizeGhanaPhone("024 412 3456")).toBe("0244123456");
  });

  it("rejects an implausible number", () => {
    expect(normalizeGhanaPhone("12345")).toBeNull();
    expect(normalizeGhanaPhone("not a phone number")).toBeNull();
  });
});

describe("maskGhanaPhone", () => {
  it("masks the middle digits, keeping only the first 3 and last 4", () => {
    expect(maskGhanaPhone("0244123456")).toBe("024 *** 3456");
  });
});
