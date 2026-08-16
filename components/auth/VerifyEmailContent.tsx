"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { verifyEmail } from "../../lib/auth-client";
import { safeRedirect } from "../../lib/safe-redirect";
import { FormMessage } from "../ui/FormMessage";

type Status = "verifying" | "success" | "error";

export function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const redirectParam = searchParams.get("redirect");
  const signInHref = redirectParam
    ? `/sign-in?redirect=${encodeURIComponent(safeRedirect(redirectParam))}`
    : "/sign-in";
  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    void verifyEmail({ query: { token } }).then(({ error }) => {
      if (cancelled) return;
      setStatus(error ? "error" : "success");
    });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div
        className={`flex size-12 items-center justify-center rounded-full ${
          status === "success"
            ? "bg-brand-100 text-brand-700"
            : status === "error"
              ? "bg-red-100 text-red-600"
              : "bg-stone-100 text-stone-500"
        }`}
      >
        {status === "verifying" ? <Loader2 className="size-6 animate-spin" strokeWidth={1.75} /> : null}
        {status === "success" ? <CheckCircle2 className="size-6" strokeWidth={1.75} /> : null}
        {status === "error" ? <XCircle className="size-6" strokeWidth={1.75} /> : null}
      </div>

      <h1 className="text-2xl font-medium text-stone-900">Email verification</h1>

      {status === "verifying" ? (
        <p className="text-[15px] text-stone-500">Verifying your email…</p>
      ) : null}

      {status === "success" ? (
        <>
          <FormMessage tone="success">Your email is verified.</FormMessage>
          <Link href={signInHref} className="text-sm font-medium text-brand-700 hover:underline">
            Continue to sign in
          </Link>
        </>
      ) : null}

      {status === "error" ? (
        <>
          <FormMessage tone="error">
            This verification link is invalid or has expired.
          </FormMessage>
          <Link href="/sign-in" className="text-sm font-medium text-brand-700 hover:underline">
            Back to sign in
          </Link>
        </>
      ) : null}
    </div>
  );
}
