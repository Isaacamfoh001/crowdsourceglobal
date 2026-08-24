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
    <div className="min-h-screen bg-ivory-50">
      <header className="border-b border-ivory-300">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <Logo />
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationBell unreadCount={bellData.unreadCount} recent={bellData.recent} />
            <SignOutButton size="sm" />
          </div>
        </div>
      </header>

      <Container className="max-w-6xl py-8 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[200px_1fr] lg:gap-10">
          <AccountNav />
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </div>
  );
}
