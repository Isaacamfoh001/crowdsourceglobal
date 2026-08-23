"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
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
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-champagne-200 text-forest-800">
          <Mail className="size-6" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-medium text-espresso-950">Check your email</h1>
        <FormMessage tone="success">
          If an account exists for that email, we&apos;ve sent a link to reset your
          password.
        </FormMessage>
        <Link href="/sign-in" className="text-sm font-medium text-forest-800 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link
          href="/sign-in"
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-espresso-900/50 hover:text-espresso-800"
        >
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
        <h1 className="text-2xl font-medium text-espresso-950">Forgot your password?</h1>
        <p className="mt-1.5 text-[15px] text-espresso-900/50">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isSubmitting}
        />

        <Button type="submit" size="lg" fullWidth disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </div>
  );
}
