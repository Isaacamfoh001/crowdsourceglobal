import { Logo } from "../../../components/layout/Logo";
import { SignOutButton } from "../../../components/auth/SignOutButton";
import { AccountNav } from "../../../components/account/AccountNav";
import { Container } from "../../../components/ui/Container";
import { NotificationBell } from "../../../components/notifications/NotificationBell";
import { getCurrentSession } from "../../../modules/identity/policy";
import { notificationsService } from "../../../modules/notifications/service";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  const bellData = session ? await notificationsService.getBellData(session.user.id) : { unreadCount: 0, recent: [] };

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <NotificationBell unreadCount={bellData.unreadCount} recent={bellData.recent} />
            <SignOutButton size="sm" />
          </div>
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
