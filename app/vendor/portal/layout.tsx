import Link from "next/link";
import { Logo } from "../../../components/layout/Logo";
import { SignOutButton } from "../../../components/auth/SignOutButton";
import { Container } from "../../../components/ui/Container";
import { PortalNav } from "../../../components/vendor-portal/PortalNav";
import { NotificationBell } from "../../../components/notifications/NotificationBell";
import { requireVendorPortalContext } from "../../../modules/vendors/policy";
import { notificationsService } from "../../../modules/notifications/service";

export default async function VendorPortalLayout({ children }: { children: React.ReactNode }) {
  const { vendor, session } = await requireVendorPortalContext("/vendor/portal");
  const bellData = await notificationsService.getBellData(session.user.id);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden text-sm text-stone-400 sm:inline">/ Vendor Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/shop" className="hidden text-sm font-medium text-stone-600 hover:text-stone-900 sm:inline">
              View marketplace
            </Link>
            <NotificationBell unreadCount={bellData.unreadCount} recent={bellData.recent} />
            <SignOutButton size="sm" />
          </div>
        </div>
      </header>

      <Container className="max-w-6xl py-10 sm:py-12">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Selling as</p>
          <p className="font-display text-lg font-medium text-stone-900">{vendor.companyName}</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <PortalNav />
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </div>
  );
}
