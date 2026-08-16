import { Suspense } from "react";
import { VerifyEmailContent } from "../../../components/auth/VerifyEmailContent";

export const metadata = { title: "Verify email — CrownSourceGlobal" };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
