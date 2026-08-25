import { Container } from "../../../../components/ui/Container";
import { TalentApplicationForm } from "../../../../components/careers/TalentApplicationForm";

export const metadata = {
  title: "Apply — Beauty Talent",
  description: "Apply to CrownSourceGlobal's Beauty Talent programme. No CV required — show us your work.",
};

export default function TalentApplyPage() {
  return (
    <div className="bg-ivory-100 py-10 sm:py-14">
      <Container className="max-w-2xl">
        <TalentApplicationForm />
      </Container>
    </div>
  );
}
