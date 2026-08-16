import { SiteHeader } from "../../components/layout/SiteHeader";
import { SiteFooter } from "../../components/layout/SiteFooter";
import { getCurrentSession, getCurrentCustomerProfile } from "../../modules/identity/policy";
import { cartService } from "../../modules/cart/service";
import { vendorsService } from "../../modules/vendors/service";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  let cartItemCount = 0;
  let hasVendorPortal = false;
  if (session) {
    const [customerProfile, membership] = await Promise.all([
      getCurrentCustomerProfile(session.user.id),
      vendorsService.getFirstMembershipForUser(session.user.id),
    ]);
    if (customerProfile) {
      cartItemCount = await cartService.getItemCount(customerProfile.id);
    }
    hasVendorPortal = membership !== null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isSignedIn={Boolean(session)} cartItemCount={cartItemCount} hasVendorPortal={hasVendorPortal} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
