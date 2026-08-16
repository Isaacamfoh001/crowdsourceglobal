import { describe, expect, it } from "vitest";
import { validateRegistration } from "./validation";

describe("validateRegistration", () => {
  it("returns no errors for valid input", () => {
    expect(validateRegistration("Ama Owusu", "ama@example.com", "password123")).toEqual({});
  });

  it("flags a name shorter than 2 characters", () => {
    const errors = validateRegistration("A", "ama@example.com", "password123");
    expect(errors.name).toBeDefined();
  });

  it("flags an invalid email", () => {
    const errors = validateRegistration("Ama Owusu", "not-an-email", "password123");
    expect(errors.email).toBeDefined();
  });

  it("flags a password shorter than 8 characters", () => {
    const errors = validateRegistration("Ama Owusu", "ama@example.com", "short");
    expect(errors.password).toBeDefined();
  });

  it("reports all three errors independently", () => {
    const errors = validateRegistration("", "bad", "123");
    expect(errors.name).toBeDefined();
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });
});
