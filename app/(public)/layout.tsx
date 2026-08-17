import { SiteHeader } from "../../components/layout/SiteHeader";
import { SiteFooter } from "../../components/layout/SiteFooter";
import { getCurrentSession, getCurrentCustomerProfile } from "../../modules/identity/policy";
import { cartService } from "../../modules/cart/service";
import { vendorsService } from "../../modules/vendors/service";
import { getAdminContext } from "../../modules/administration/policy";
import { notificationsService } from "../../modules/notifications/service";
import type { NotificationView } from "../../modules/notifications/types";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  let cartItemCount = 0;
  let hasVendorPortal = false;
  let isAdmin = false;
  let unreadCount = 0;
  let recentNotifications: NotificationView[] = [];
  if (session) {
    const [customerProfile, membership, admin, bellData] = await Promise.all([
      getCurrentCustomerProfile(session.user.id),
      vendorsService.getFirstMembershipForUser(session.user.id),
      getAdminContext(session.user.id),
      notificationsService.getBellData(session.user.id),
    ]);
    if (customerProfile) {
      cartItemCount = await cartService.getItemCount(customerProfile.id);
    }
    hasVendorPortal = membership !== null;
    isAdmin = admin !== null;
    unreadCount = bellData.unreadCount;
    recentNotifications = bellData.recent;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        isSignedIn={Boolean(session)}
        cartItemCount={cartItemCount}
        hasVendorPortal={hasVendorPortal}
        isAdmin={isAdmin}
        unreadNotificationCount={unreadCount}
        recentNotifications={recentNotifications}
      />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
