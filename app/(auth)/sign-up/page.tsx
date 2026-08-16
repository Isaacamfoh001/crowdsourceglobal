import { Suspense } from "react";
import { SignUpForm } from "../../../components/auth/SignUpForm";
import { googleOAuthConfigured } from "../../../lib/env";

export const metadata = { title: "Create your account — CrownSourceGlobal" };

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm googleEnabled={googleOAuthConfigured} />
    </Suspense>
  );
}
