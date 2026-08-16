"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, sendVerificationEmail } from "../../lib/auth-client";
import { safeRedirect } from "../../lib/safe-redirect";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import { GoogleButton } from "./GoogleButton";

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"));
  const [formError, setFormError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setUnverifiedEmail(null);
    setResendState("idle");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    setIsSubmitting(true);
    const { error } = await signIn.email({ email, password });
    setIsSubmitting(false);

    if (error) {
      if (error.status === 403) {
        setUnverifiedEmail(email);
        setFormError("Please verify your email before signing in.");
      } else {
        setFormError(error.message ?? "Invalid email or password.");
      }
      return;
    }

    router.push(redirectTo);
  }

  async function handleResend() {
    if (!unverifiedEmail) return;
    setResendState("sending");
    await sendVerificationEmail({ email: unverifiedEmail });
    setResendState("sent");
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-medium text-stone-900">Welcome back</h1>
        <p className="mt-1.5 text-[15px] text-stone-500">
          Sign in to your CrownSourceGlobal account.
        </p>
      </div>

      {googleEnabled ? (
        <>
          <GoogleButton label="Continue with Google" callbackURL={redirectTo} />
          <div className="flex items-center gap-3 text-xs font-medium tracking-wide text-stone-400 uppercase">
            <div className="h-px flex-1 bg-stone-200" />
            or
            <div className="h-px flex-1 bg-stone-200" />
          </div>
        </>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError ? (
          <FormMessage tone="error">
            {formError}
            {unverifiedEmail ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState !== "idle"}
                  className="font-medium text-red-700 underline disabled:no-underline"
                >
                  {resendState === "sending"
                    ? "Sending…"
                    : resendState === "sent"
                      ? "Verification email sent"
                      : "Resend verification email"}
                </button>
              </div>
            ) : null}
          </FormMessage>
        ) : null}

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isSubmitting}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-stone-700">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
            className="w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-[15px] text-stone-900 shadow-soft outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <Button type="submit" size="lg" fullWidth disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-stone-500">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-medium text-brand-700 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
