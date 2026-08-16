import { StepShell } from "../../../../components/vendor-onboarding/StepShell";
import { BusinessForm } from "../../../../components/vendor-onboarding/BusinessForm";
import { requireEditableApplication } from "../../../../modules/vendor-applications/policy";
import { REGISTRATION_RELEVANT_SELLER_TYPES } from "../../../../modules/vendor-applications/types";

export const metadata = { title: "Business information — CrownSourceGlobal" };
export const dynamic = "force-dynamic";

export default async function BusinessStepPage() {
  const { application } = await requireEditableApplication("/vendor/onboarding/business");

  const showRegistrationFields = application.sellerType
    ? REGISTRATION_RELEVANT_SELLER_TYPES.includes(application.sellerType)
    : false;

  return (
    <StepShell
      step="business"
      title="Business information"
      subtitle="Tell us about your store and where you're based."
    >
      <BusinessForm initial={application} showRegistrationFields={showRegistrationFields} />
    </StepShell>
  );
}
