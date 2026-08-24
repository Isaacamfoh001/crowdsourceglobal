import Link from "next/link";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";

export const metadata = { title: "Settings — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorSettingsPage() {
  const { session, vendor, role } = await requireVendorPortalContext("/vendor/portal/settings");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-espresso-950">Settings</h1>

      <div className="flex flex-col divide-y divide-ivory-200 border-t border-ivory-300">
        <div className="py-6 first:pt-0">
          <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Account</h2>
          <dl className="mt-2 divide-y divide-ivory-100">
            <div className="flex justify-between py-2.5 text-sm">
              <dt className="text-espresso-900/50">Signed in as</dt>
              <dd className="text-espresso-950">{session.user.email}</dd>
            </div>
            <div className="flex justify-between py-2.5 text-sm">
              <dt className="text-espresso-900/50">Role on this store</dt>
              <dd className="text-espresso-950">{role === "OWNER" ? "Owner" : "Staff"}</dd>
            </div>
            <div className="flex justify-between py-2.5 text-sm">
              <dt className="text-espresso-900/50">Storefront</dt>
              <dd>
                <Link href={`/vendors/${vendor.storefrontSlug}`} className="font-medium text-forest-800 hover:underline">
                  View public page
                </Link>
              </dd>
            </div>
          </dl>
        </div>

        <div className="py-6 last:pb-0">
          <h2 className="text-xs font-semibold tracking-[0.1em] text-espresso-900/45 uppercase">Store details</h2>
          <p className="mt-2 text-sm text-espresso-900/50">
            Store name, description, location, and contact details live on your{" "}
            <Link href="/vendor/portal/store" className="font-medium text-forest-800 hover:underline">
              Store profile
            </Link>{" "}
            page.
          </p>
        </div>
      </div>
    </div>
  );
}
