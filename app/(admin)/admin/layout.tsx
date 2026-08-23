import { Logo } from "../../../components/layout/Logo";
import { SignOutButton } from "../../../components/auth/SignOutButton";
import { Container } from "../../../components/ui/Container";
import { AdminNav } from "../../../components/admin/AdminNav";
import { AdminSearchBar } from "../../../components/admin/AdminSearchBar";
import { NotificationBell } from "../../../components/notifications/NotificationBell";
import { requireAdminSession } from "../../../modules/administration/policy";
import { notificationsService } from "../../../modules/notifications/service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, session } = await requireAdminSession("/admin");
  const bellData = await notificationsService.getBellData(session.user.id);

  return (
    <div className="min-h-screen bg-ivory-50">
      <header className="border-b border-ivory-300 bg-espresso-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo onDark />
            <span className="hidden truncate text-sm text-ivory-200/40 sm:inline">/ Admin ({admin.role})</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationBell unreadCount={bellData.unreadCount} recent={bellData.recent} onDark />
            <SignOutButton size="sm" />
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-3 sm:px-6">
          <AdminSearchBar onDark />
        </div>
      </header>

      <Container className="max-w-6xl py-8 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
          <AdminNav />
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </div>
  );
}
