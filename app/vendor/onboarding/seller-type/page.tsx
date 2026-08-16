import { StepShell } from "../../../../components/vendor-onboarding/StepShell";
import { SellerTypeForm } from "../../../../components/vendor-onboarding/SellerTypeForm";
import { requireEditableApplication } from "../../../../modules/vendor-applications/policy";

export const metadata = { title: "Who are you selling as? — CrownSourceGlobal" };
export const dynamic = "force-dynamic";

export default async function SellerTypeStepPage() {
  const { application } = await requireEditableApplication("/vendor/onboarding/seller-type");

  return (
    <StepShell
      step="seller-type"
      title="Who are you selling as?"
      subtitle="This shapes what we ask you for next — there's no wrong answer."
    >
      <SellerTypeForm initialValue={application.sellerType} />
    </StepShell>
  );
}
