"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signUp } from "../../lib/auth-client";
import { validateRegistration, type RegistrationFieldErrors } from "../../modules/identity/validation";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { FormMessage } from "../ui/FormMessage";
import { GoogleButton } from "./GoogleButton";

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const errors = validateRegistration(name, email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    const { error } = await signUp.email({ name, email, password });
    setIsSubmitting(false);

    if (error) {
      setFormError(error.message ?? "Something went wrong creating your account.");
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Check your email</h1>
        <FormMessage tone="success">
          We&apos;ve sent a verification link to your inbox. Verify your email to finish
          setting up your CrownSourceGlobal account.
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
        <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Shop normally, buy in bulk, or request custom sourcing.
        </p>
      </div>

      {googleEnabled ? (
        <>
          <GoogleButton label="Continue with Google" />
          <div className="flex items-center gap-3 text-xs font-medium uppercase text-slate-400">
            <div className="h-px flex-1 bg-slate-200" />
            or
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        </>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {formError ? <FormMessage tone="error">{formError}</FormMessage> : null}

        <Input
          label="Full name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Ama Owusu"
          error={fieldErrors.name}
          disabled={isSubmitting}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={fieldErrors.email}
          disabled={isSubmitting}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={fieldErrors.password}
          disabled={isSubmitting}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-blue-700 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
