import { Suspense } from "react";
import { SignInForm } from "../../../components/auth/SignInForm";
import { googleOAuthConfigured } from "../../../lib/env";

export const metadata = { title: "Sign in — CrownSourceGlobal" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm googleEnabled={googleOAuthConfigured} />
    </Suspense>
  );
}
