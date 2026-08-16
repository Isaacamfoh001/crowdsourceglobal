"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyEmail } from "../../lib/auth-client";
import { FormMessage } from "../ui/FormMessage";

type Status = "verifying" | "success" | "error";

export function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
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
      <h1 className="text-xl font-semibold text-slate-900">Email verification</h1>

      {status === "verifying" ? (
        <p className="text-sm text-slate-500">Verifying your email…</p>
      ) : null}

      {status === "success" ? (
        <>
          <FormMessage tone="success">Your email is verified.</FormMessage>
          <Link href="/sign-in" className="text-sm font-medium text-blue-700 hover:underline">
            Continue to sign in
          </Link>
        </>
      ) : null}

      {status === "error" ? (
        <>
          <FormMessage tone="error">
            This verification link is invalid or has expired.
          </FormMessage>
          <Link href="/sign-in" className="text-sm font-medium text-blue-700 hover:underline">
            Back to sign in
          </Link>
        </>
      ) : null}
    </div>
  );
}
