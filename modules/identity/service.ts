import { identityRepository } from "./repository";

/**
 * CrownSourceGlobal owns CustomerProfile creation regardless of which
 * authentication method (email/password or Google) produced the
 * underlying Better Auth User — see docs/decisions/0002-authentication.md.
 *
 * Called from lib/auth.ts's `databaseHooks.user.create.after` hook, which
 * fires for every user-creation path Better Auth supports, so this is the
 * single place a CustomerProfile is ever created — not duplicated per
 * sign-up route.
 */
export const identityService = {
  async ensureCustomerProfile(user: { id: string; name: string }) {
    const existing = await identityRepository.findCustomerProfileByUserId(user.id);
    if (existing) {
      return existing;
    }

    return identityRepository.createCustomerProfile({
      userId: user.id,
      displayName: user.name,
    });
  },

  getCustomerProfileByUserId(userId: string) {
    return identityRepository.findCustomerProfileByUserId(userId);
  },
};
