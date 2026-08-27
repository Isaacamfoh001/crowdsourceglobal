// @vitest-environment node
//
// Proves the actual native/Expo authentication path this repository will
// support once crownsourceglobal-mobile exists — WITHOUT a running server
// or an Expo client, by driving the real `auth` instance the same way
// lib/auth-email-verification.test.ts does (real auth.api.* calls, real
// local Postgres dev database, only the outbound email send mocked).
//
// What this test intentionally does NOT fake: sign-up, email verification,
// sign-in, the bearer plugin's token verification, and auth.api.getSession's
// session resolution are all the real Better Auth code path (M18.1 added
// the `bearer()` plugin in lib/auth.ts specifically so this works). The one
// thing it cannot reproduce outside a real Next.js request is next/headers()
// itself — modules/identity/policy.ts's getCurrentSession() reads the
// incoming request's headers via next/headers(), which only exists inside
// an active Next.js request context, not a bare Vitest process. So this
// test stubs getCurrentSession() to forward this test's own real Headers
// object into the real auth.api.getSession() call instead — i.e. it removes
// only the Next.js plumbing, not the authentication mechanism itself.
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../../lib/db";
import { auth } from "../../../../lib/auth";
import * as emailProviderModule from "../../../../lib/email-provider";

vi.mock("../../../../modules/identity/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../modules/identity/policy")>();
  return { ...actual, getCurrentSession: vi.fn() };
});

import { getCurrentSession } from "../../../../modules/identity/policy";
import { GET } from "./route";

describe("Native (bearer-token) authentication against GET /api/v1/me", () => {
  const createdUserIds: string[] = [];

  afterEach(() => {
    vi.mocked(getCurrentSession).mockReset();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.customerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  function uniqueEmail(label: string) {
    return `native-auth.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  }

  /** Signs up + verifies a fresh user and returns the real Bearer session token from a real sign-in. */
  async function createVerifiedUserAndSignIn(label: string) {
    const email = uniqueEmail(label);
    const password = "password123";

    let capturedUrl: string | null = null;
    vi.spyOn(emailProviderModule.emailProvider, "send").mockImplementationOnce(async (message) => {
      capturedUrl = message.text.match(/https?:\/\/\S+/)?.[0] ?? null;
    });

    const signUpResult = await auth.api.signUpEmail({ body: { name: `${label} Native User`, email, password } });
    createdUserIds.push(signUpResult.user.id);

    const verificationToken = new URL(capturedUrl!).searchParams.get("token");
    await auth.api.verifyEmail({ query: { token: verificationToken! } });

    // Real native login: email + password → a real Better Auth session token.
    // This is exactly what a future Expo client's sign-in call returns.
    const signInResult = await auth.api.signInEmail({ body: { email, password } });

    return { userId: signUpResult.user.id, sessionToken: signInResult.token as string };
  }

  it("resolves the correct signed-in user from a real Authorization: Bearer <token> header, with no cookie involved at all", async () => {
    const { userId, sessionToken } = await createVerifiedUserAndSignIn("bearer-ok");

    // Exactly the shape a future Expo client sends: no Cookie header, only
    // Authorization. Proves the request path end to end:
    //   native sign-in → session token → Authorization: Bearer header
    //   → bearer() plugin verifies + rewrites it → auth.api.getSession
    //   resolves the same session a cookie-based browser request would.
    const nativeRequest = new Request("http://localhost/api/v1/me", {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(nativeRequest.headers.get("cookie")).toBeNull();

    vi.mocked(getCurrentSession).mockImplementation(() => auth.api.getSession({ headers: nativeRequest.headers }));

    const response = await GET(nativeRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.id).toBe(userId);
  });

  it("rejects a forged/garbage bearer token — the plugin's HMAC verification, not merely header presence, gates access", async () => {
    const forgedRequest = new Request("http://localhost/api/v1/me", {
      headers: { authorization: "Bearer not-a-real-session-token" },
    });

    vi.mocked(getCurrentSession).mockImplementation(() => auth.api.getSession({ headers: forgedRequest.headers }));

    const response = await GET(forgedRequest);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an unauthenticated request with no Authorization header at all", async () => {
    const bareRequest = new Request("http://localhost/api/v1/me");

    vi.mocked(getCurrentSession).mockImplementation(() => auth.api.getSession({ headers: bareRequest.headers }));

    const response = await GET(bareRequest);

    expect(response.status).toBe(401);
  });
});
