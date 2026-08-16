import { Suspense } from "react";
import { ResetPasswordForm } from "../../../components/auth/ResetPasswordForm";

export const metadata = { title: "Reset password — CrownSourceGlobal" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
