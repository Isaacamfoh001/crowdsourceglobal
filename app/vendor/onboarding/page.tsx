import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Hourglass, PenLine, ShieldQuestion, Store } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { FormMessage } from "../../../components/ui/FormMessage";
import { requireSession } from "../../../modules/identity/policy";
import { vendorApplicationsService } from "../../../modules/vendor-applications/service";
import { vendorsService } from "../../../modules/vendors/service";
import { startApplicationAction } from "../../../lib/actions/vendor-application";

export const metadata = { title: "Vendor onboarding — CrownSourceGlobal" };
export const dynamic = "force-dynamic";

export default async function VendorOnboardingStatusPage() {
  const session = await requireSession("/vendor/onboarding");

  const membership = await vendorsService.getFirstMembershipForUser(session.user.id);
  if (membership) {
    redirect("/vendor/portal");
  }

  const application = await vendorApplicationsService.getForUser(session.user.id);

  if (!application) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Store className="size-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium text-stone-900">
          Become a CrownSourceGlobal vendor
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-stone-600">
          A few short steps — who you are, what you sell, and how you operate. You can save
          your progress and finish later.
        </p>
        <form action={startApplicationAction} className="mt-8">
          <Button size="lg">Get started</Button>
        </form>
      </div>
    );
  }

  if (["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(application.status)) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gold-100 text-gold-700">
          <PenLine className="size-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium text-stone-900">
          {application.status === "DRAFT" ? "Continue your application" : "Update your application"}
        </h1>
        {application.status !== "DRAFT" && application.decisionReason ? (
          <div className="mt-4 w-full max-w-md text-left">
            <FormMessage tone="error">{application.decisionReason}</FormMessage>
          </div>
        ) : (
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-stone-600">
            Pick up where you left off — your answers are saved.
          </p>
        )}
        <Link href="/vendor/onboarding/seller-type" className="mt-8">
          <Button size="lg">Continue application</Button>
        </Link>
      </div>
    );
  }

  if (["SUBMITTED", "UNDER_REVIEW"].includes(application.status)) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
          <Hourglass className="size-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium text-stone-900">
          Application under review
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-stone-600">
          Thanks for applying, {application.contactName ?? session.user.name}. Our team is
          reviewing your application and will let you know once it&apos;s decided. This
          usually doesn&apos;t take long.
        </p>
        <Link href="/account" className="mt-8">
          <Button variant="outline" size="lg">
            Back to your account
          </Button>
        </Link>
      </div>
    );
  }

  if (application.status === "APPROVED") {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <CheckCircle2 className="size-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium text-stone-900">
          Your vendor account is approved
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-stone-600">
          Welcome to CrownSourceGlobal. Head into your Vendor Portal to set up your store.
        </p>
        <Link href="/vendor/portal" className="mt-8">
          <Button size="lg">Go to Vendor Portal</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
        <ShieldQuestion className="size-7" strokeWidth={1.75} />
      </div>
      <h1 className="mt-6 font-display text-3xl font-medium text-stone-900">Application status</h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-stone-600">
        Something unexpected happened with your application status. Contact support if this
        persists.
      </p>
    </div>
  );
}
