import { StepShell } from "../../../../components/vendor-onboarding/StepShell";
import { OperationsForm } from "../../../../components/vendor-onboarding/OperationsForm";
import { requireEditableApplication } from "../../../../modules/vendor-applications/policy";
import { catalogueService } from "../../../../modules/catalogue/service";

export const metadata = { title: "What you sell — CrownSourceGlobal" };
export const dynamic = "force-dynamic";

export default async function OperationsStepPage() {
  const { application } = await requireEditableApplication("/vendor/onboarding/operations");
  const categories = await catalogueService.listCategories();

  return (
    <StepShell
      step="operations"
      title="What you sell, and how"
      subtitle="This helps us route your listings to the right categories and set expectations with buyers."
    >
      <OperationsForm
        categories={categories}
        initial={{
          categorySlugs: application.categorySlugs,
          sellingMode: application.sellingMode,
          bulkCapable: application.bulkCapable,
          leadTimeDaysDefault: application.leadTimeDaysDefault,
          serviceAreas: application.serviceAreas,
        }}
      />
    </StepShell>
  );
}
