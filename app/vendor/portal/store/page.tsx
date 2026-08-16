import { notFound } from "next/navigation";
import { StoreProfileForm } from "../../../../components/vendor-portal/StoreProfileForm";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { vendorsService } from "../../../../modules/vendors/service";
import { catalogueService } from "../../../../modules/catalogue/service";

export const metadata = { title: "Store profile — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorStoreProfilePage() {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/store");
  const [profile, categories] = await Promise.all([
    vendorsService.getStoreProfile(vendorId),
    catalogueService.listCategories(),
  ]);

  if (!profile) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">Store profile</h1>
        <p className="mt-1 text-[15px] text-stone-500">
          What customers see on your storefront, plus how CrownSourceGlobal reaches you.
        </p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-8">
        <StoreProfileForm profile={profile} categories={categories} />
      </div>
    </div>
  );
}
