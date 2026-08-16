"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "../../lib/auth-client";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldError(undefined);

    if (!token) {
      setFormError("This reset link is missing its token. Request a new one.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < 8) {
      setFieldError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await resetPassword({ newPassword, token });
    setIsSubmitting(false);

    if (error) {
      setFormError(error.message ?? "This reset link is invalid or has expired.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/sign-in"), 1500);
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Password updated</h1>
        <FormMessage tone="success">Redirecting you to sign in…</FormMessage>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-900">Set a new password</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

        <Input
          label="New password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          error={fieldError}
          disabled={isSubmitting}
        />
        <Input
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          disabled={isSubmitting}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
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
