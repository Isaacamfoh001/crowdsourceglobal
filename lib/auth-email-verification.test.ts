// @vitest-environment node
//
// Better Auth signs verification tokens via `jose`, which requires real
// Node Uint8Array/WebCrypto globals — under this project's default jsdom
// environment (vitest.config.ts), jose's `instanceof Uint8Array` check
// fails because jsdom's realm has its own Uint8Array. No other test file
// needs this override; it's scoped to this one via the magic comment above.
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./db";
import { auth } from "./auth";
import * as emailProviderModule from "./email-provider";

/**
 * End-to-end trace of email/password sign-up → verification, against
 * Better Auth's real `auth.api.*` handlers and the real local Postgres dev
 * database (same conventions as modules/*\/service.test.ts). Only the
 * outbound network send (`emailProvider.send`) is mocked — nothing about
 * Better Auth or our own hook wiring in lib/auth.ts is stubbed. No real
 * email is ever sent by this suite.
 */
describe("email/password sign-up verification", () => {
  const createdUserIds: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  function uniqueEmail(label: string) {
    return `verify.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  }

  it("sign-up enqueues a verification email pointed at our own /verify-email page under NEXT_PUBLIC_APP_URL", async () => {
    const sendSpy = vi.spyOn(emailProviderModule.emailProvider, "send").mockResolvedValueOnce();
    const email = uniqueEmail("signup");

    const result = await auth.api.signUpEmail({
      body: { name: "Verify Test", email, password: "password123" },
    });
    createdUserIds.push(result.user.id);

    expect(result.user.emailVerified).toBe(false);
    // requireEmailVerification means no session token is issued pre-verification.
    expect(result.token).toBeNull();

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const [message] = sendSpy.mock.calls[0]!;
    expect(message.to).toBe(email);
    expect(message.subject).toMatch(/verify/i);
    expect(message.text).toContain(`${process.env["NEXT_PUBLIC_APP_URL"]}/verify-email?token=`);
  });

  it("forwards a checkout-time callbackURL through to the verification link as ?redirect=", async () => {
    const sendSpy = vi.spyOn(emailProviderModule.emailProvider, "send").mockResolvedValueOnce();
    const email = uniqueEmail("callback");

    const result = await auth.api.signUpEmail({
      body: { name: "Verify Test", email, password: "password123", callbackURL: "/checkout" },
    });
    createdUserIds.push(result.user.id);

    const [message] = sendSpy.mock.calls[0]!;
    expect(message.text).toContain("redirect=%2Fcheckout");
  });

  it("clicking the verification link marks the user's email verified", async () => {
    let capturedUrl: string | null = null;
    vi.spyOn(emailProviderModule.emailProvider, "send").mockImplementationOnce(async (message) => {
      capturedUrl = message.text.match(/https?:\/\/\S+/)?.[0] ?? null;
    });
    const email = uniqueEmail("clicklink");

    const result = await auth.api.signUpEmail({
      body: { name: "Verify Test", email, password: "password123" },
    });
    createdUserIds.push(result.user.id);

    expect(capturedUrl).not.toBeNull();
    const token = new URL(capturedUrl!).searchParams.get("token");
    expect(token).toBeTruthy();

    await auth.api.verifyEmail({ query: { token: token! } });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
    expect(user.emailVerified).toBe(true);
  });

  it("resending the verification email (sign-in's 'resend' action) sends again for an unverified user", async () => {
    const sendSpy = vi.spyOn(emailProviderModule.emailProvider, "send").mockResolvedValue();
    const email = uniqueEmail("resend");
    const result = await auth.api.signUpEmail({ body: { name: "Verify Test", email, password: "password123" } });
    createdUserIds.push(result.user.id);

    sendSpy.mockClear();
    await auth.api.sendVerificationEmail({ body: { email } });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0]![0].to).toBe(email);
  });

  it("a provider failure (e.g. Resend rejecting the recipient) is swallowed by Better Auth's background-task handling — sign-up still reports success to the caller", async () => {
    vi.spyOn(emailProviderModule.emailProvider, "send").mockRejectedValueOnce(
      new Error("Resend send failed (403): You can only send testing emails to your own verified address"),
    );
    const email = uniqueEmail("providerfail");

    // This is the exact staging symptom: no thrown/rejected error reaches
    // the caller even though delivery genuinely failed — the UI has no way
    // to know and always renders "check your email".
    const result = await auth.api.signUpEmail({
      body: { name: "Verify Test", email, password: "password123" },
    });
    createdUserIds.push(result.user.id);

    expect(result.user.email).toBe(email);
    expect(result.user.emailVerified).toBe(false);
  });
});
