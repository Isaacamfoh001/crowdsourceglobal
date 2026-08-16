import { Logo } from "../../../components/layout/Logo";
import { SignOutButton } from "../../../components/auth/SignOutButton";
import { AccountNav } from "../../../components/account/AccountNav";
import { Container } from "../../../components/ui/Container";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <SignOutButton size="sm" />
        </div>
      </header>

      <Container className="max-w-6xl py-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <AccountNav />
          <div>{children}</div>
        </div>
      </Container>
    </div>
  );
}
