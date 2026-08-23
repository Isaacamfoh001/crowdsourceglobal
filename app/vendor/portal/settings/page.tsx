import Link from "next/link";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";

export const metadata = { title: "Settings — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorSettingsPage() {
  const { session, vendor, role } = await requireVendorPortalContext("/vendor/portal/settings");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-espresso-950">Settings</h1>

      <div className="rounded-2xl border border-ivory-300 bg-white p-6">
        <h2 className="font-display text-base font-medium text-espresso-950">Account</h2>
        <dl className="mt-3 divide-y divide-ivory-100">
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

      <div className="rounded-2xl border border-ivory-300 bg-white p-6">
        <h2 className="font-display text-base font-medium text-espresso-950">Store details</h2>
        <p className="mt-1.5 text-sm text-espresso-900/50">
          Store name, description, location, and contact details live on your{" "}
          <Link href="/vendor/portal/store" className="font-medium text-forest-800 hover:underline">
            Store profile
          </Link>{" "}
          page.
        </p>
      </div>
    </div>
  );
}
