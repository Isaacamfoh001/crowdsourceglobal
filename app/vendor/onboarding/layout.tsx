import Link from "next/link";
import { Logo } from "../../../components/layout/Logo";
import { SignOutButton } from "../../../components/auth/SignOutButton";

export default function VendorOnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory-50">
      <header className="border-b border-ivory-300 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <Logo />
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link
              href="/account"
              className="hidden text-sm font-medium text-espresso-900/65 hover:text-espresso-950 sm:inline"
            >
              Your account
            </Link>
            <SignOutButton size="sm" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">{children}</div>
    </div>
  );
}
