import { Logo } from "../../../components/layout/Logo";
import { SignOutButton } from "../../../components/auth/SignOutButton";
import { Container } from "../../../components/ui/Container";
import { AdminNav } from "../../../components/admin/AdminNav";
import { NotificationBell } from "../../../components/notifications/NotificationBell";
import { requireAdminSession } from "../../../modules/administration/policy";
import { notificationsService } from "../../../modules/notifications/service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, session } = await requireAdminSession("/admin");
  const bellData = await notificationsService.getBellData(session.user.id);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-stone-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo onDark />
            <span className="hidden text-sm text-stone-400 sm:inline">/ Admin ({admin.role})</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell unreadCount={bellData.unreadCount} recent={bellData.recent} onDark />
            <SignOutButton size="sm" />
          </div>
        </div>
      </header>

      <Container className="max-w-6xl py-10 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <AdminNav />
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </div>
  );
}
