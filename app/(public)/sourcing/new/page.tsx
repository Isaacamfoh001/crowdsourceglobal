import { Container } from "../../../../components/ui/Container";
import { SourcingRequestForm } from "../../../../components/sourcing/SourcingRequestForm";
import { requireSession } from "../../../../modules/identity/policy";
import { catalogueService } from "../../../../modules/catalogue/service";

export const metadata = { title: "New sourcing request" };
export const dynamic = "force-dynamic";

export default async function NewSourcingRequestPage() {
  // Custom Sourcing requests are CustomerProfile-owned, same as Cart —
  // requiring sign-in before the form renders (rather than trying to
  // preserve a multi-field form plus file attachments across an auth
  // detour) is the simplest robust choice here; the public landing page at
  // /sourcing remains freely browsable for a signed-out visitor.
  await requireSession("/sourcing/new");
  const categories = await catalogueService.listCategories();

  return (
    <div className="bg-ivory-50 py-10 sm:py-14">
      <Container className="max-w-2xl">
        <h1 className="font-display text-3xl font-medium text-espresso-950">Request custom sourcing</h1>
        <p className="mt-1.5 text-[15px] text-espresso-900/65">
          Tell us what you need — our sourcing team will review it and reach out through CrownSourceGlobal if
          we need more information.
        </p>
        <div className="mt-8">
          <SourcingRequestForm categories={categories} />
        </div>
      </Container>
    </div>
  );
}
