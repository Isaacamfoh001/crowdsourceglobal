import { StepShell } from "../../../../components/vendor-onboarding/StepShell";
import { ReviewForm } from "../../../../components/vendor-onboarding/ReviewForm";
import { requireEditableApplication } from "../../../../modules/vendor-applications/policy";

export const metadata = { title: "Review your application — CrownSourceGlobal" };
export const dynamic = "force-dynamic";

export default async function ReviewStepPage() {
  const { application } = await requireEditableApplication("/vendor/onboarding/review");

  return (
    <StepShell
      step="review"
      title="Review your application"
      subtitle="Check everything looks right, then submit for review."
    >
      <ReviewForm application={application} />
    </StepShell>
  );
}
