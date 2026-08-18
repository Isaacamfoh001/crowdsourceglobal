import { describe, expect, it } from "vitest";
import { ghsToPesewas, pesewasToGhs } from "./money";

describe("ghsToPesewas", () => {
  it("converts a whole GHS amount", () => {
    expect(ghsToPesewas(100)).toBe(10000);
  });

  it("converts a fractional GHS amount without floating-point drift", () => {
    expect(ghsToPesewas(12.34)).toBe(1234);
    expect(ghsToPesewas(0.1)).toBe(10);
    expect(ghsToPesewas(19.99)).toBe(1999);
  });

  it("round-trips cleanly through pesewasToGhs", () => {
    expect(pesewasToGhs(ghsToPesewas(45.67))).toBe(45.67);
  });
});

describe("pesewasToGhs", () => {
  it("converts pesewas back to GHS", () => {
    expect(pesewasToGhs(10000)).toBe(100);
    expect(pesewasToGhs(1234)).toBe(12.34);
  });
});
