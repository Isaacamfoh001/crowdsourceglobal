import { describe, expect, it, vi, beforeEach } from "vitest";

const findCustomerProfileByUserId = vi.fn();
const createCustomerProfile = vi.fn();

vi.mock("./repository", () => ({
  identityRepository: {
    findCustomerProfileByUserId: (...args: unknown[]) =>
      findCustomerProfileByUserId(...args),
    createCustomerProfile: (...args: unknown[]) => createCustomerProfile(...args),
  },
}));

const { identityService } = await import("./service");

describe("identityService.ensureCustomerProfile", () => {
  beforeEach(() => {
    findCustomerProfileByUserId.mockReset();
    createCustomerProfile.mockReset();
  });

  it("creates a CustomerProfile when none exists for the user", async () => {
    findCustomerProfileByUserId.mockResolvedValue(null);
    createCustomerProfile.mockResolvedValue({
      id: "cp_1",
      userId: "user_1",
      displayName: "Ama Owusu",
    });

    const result = await identityService.ensureCustomerProfile({
      id: "user_1",
      name: "Ama Owusu",
    });

    expect(createCustomerProfile).toHaveBeenCalledWith({
      userId: "user_1",
      displayName: "Ama Owusu",
    });
    expect(result).toMatchObject({ userId: "user_1", displayName: "Ama Owusu" });
  });

  it("does not create a duplicate when a CustomerProfile already exists", async () => {
    const existing = { id: "cp_1", userId: "user_1", displayName: "Ama Owusu" };
    findCustomerProfileByUserId.mockResolvedValue(existing);

    const result = await identityService.ensureCustomerProfile({
      id: "user_1",
      name: "Ama Owusu",
    });

    expect(createCustomerProfile).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });
});
