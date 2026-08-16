"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { requestPasswordReset } from "../../lib/auth-client";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");

    setIsSubmitting(true);
    const { error } = await requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setIsSubmitting(false);

    if (error) {
      setFormError(error.message ?? "Something went wrong. Please try again.");
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Check your email</h1>
        <FormMessage tone="success">
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </FormMessage>
        <Link href="/sign-in" className="text-sm font-medium text-blue-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-900">Forgot your password?</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

        <Input label="Email" name="email" type="email" autoComplete="email" required disabled={isSubmitting} />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500">
        <Link href="/sign-in" className="font-medium text-blue-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
