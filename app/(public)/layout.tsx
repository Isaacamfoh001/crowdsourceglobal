import { SiteHeader } from "../../components/layout/SiteHeader";
import { SiteFooter } from "../../components/layout/SiteFooter";
import { getCurrentSession, getCurrentCustomerProfile } from "../../modules/identity/policy";
import { cartService } from "../../modules/cart/service";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  let cartItemCount = 0;
  if (session) {
    const customerProfile = await getCurrentCustomerProfile(session.user.id);
    if (customerProfile) {
      cartItemCount = await cartService.getItemCount(customerProfile.id);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader isSignedIn={Boolean(session)} cartItemCount={cartItemCount} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
