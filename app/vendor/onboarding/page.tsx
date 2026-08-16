import Link from "next/link";
import { Hourglass } from "lucide-react";
import { requireSession } from "../../../modules/identity/policy";
import { Logo } from "../../../components/layout/Logo";
import { Button } from "../../../components/ui/Button";

export const metadata = { title: "Vendor onboarding — CrownSourceGlobal" };

export default async function VendorOnboardingPage() {
  const session = await requireSession("/vendor/onboarding");

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Logo />
          <Link href="/account" className="text-sm font-medium text-stone-600 hover:text-stone-900">
            Your account
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <Hourglass className="size-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-6 font-display text-3xl font-medium text-stone-900">
          Vendor onboarding is coming next
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-stone-600">
          Thanks for your interest in selling on CrownSourceGlobal. Full vendor
          onboarding — including business verification and listing setup — is being
          built as our next milestone. We&apos;ll reach out to{" "}
          <span className="font-medium text-stone-900">{session.user.email}</span> as
          soon as it&apos;s ready.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/account">
            <Button variant="outline" fullWidth className="sm:w-auto">
              Back to your account
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" fullWidth className="sm:w-auto">
              Back to homepage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
