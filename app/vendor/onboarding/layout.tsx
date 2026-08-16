import Link from "next/link";
import { Logo } from "../../../components/layout/Logo";
import { SignOutButton } from "../../../components/auth/SignOutButton";

export default function VendorOnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-4">
            <Link href="/account" className="text-sm font-medium text-stone-600 hover:text-stone-900">
              Your account
            </Link>
            <SignOutButton size="sm" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">{children}</div>
    </div>
  );
}
