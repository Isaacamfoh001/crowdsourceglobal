import { StepShell } from "../../../../components/vendor-onboarding/StepShell";
import { ContactForm } from "../../../../components/vendor-onboarding/ContactForm";
import { requireEditableApplication } from "../../../../modules/vendor-applications/policy";

export const metadata = { title: "Your details — CrownSourceGlobal" };
export const dynamic = "force-dynamic";

export default async function DetailsStepPage() {
  const { application } = await requireEditableApplication("/vendor/onboarding/details");

  return (
    <StepShell step="details" title="Your details" subtitle="Who should we contact about this application?">
      <ContactForm
        initial={{
          contactName: application.contactName,
          contactEmail: application.contactEmail,
          contactPhone: application.contactPhone,
        }}
      />
    </StepShell>
  );
}
