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
    <div className="min-h-screen bg-ivory-50">
      <header className="border-b border-ivory-300">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo />
            <span className="hidden truncate text-sm text-espresso-900/35 sm:inline">/ Vendor Portal</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link href="/shop" className="hidden text-sm font-medium text-espresso-900/65 hover:text-espresso-950 sm:inline">
              View marketplace
            </Link>
            <NotificationBell unreadCount={bellData.unreadCount} recent={bellData.recent} />
            <SignOutButton size="sm" />
          </div>
        </div>
      </header>

      <Container className="max-w-6xl py-8 sm:py-12">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-espresso-900/35">Selling as</p>
          <p className="truncate font-display text-lg font-medium text-espresso-950">{vendor.companyName}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
          <PortalNav />
          <div className="min-w-0">{children}</div>
        </div>
      </Container>
    </div>
  );
}
