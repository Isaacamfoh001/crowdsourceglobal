import { NewListingForm } from "../../../../../components/vendor-portal/NewListingForm";
import { requireVendorPortalContext } from "../../../../../modules/vendors/policy";
import { catalogueService } from "../../../../../modules/catalogue/service";

export const metadata = { title: "New listing — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  await requireVendorPortalContext("/vendor/portal/listings/new");
  const categories = await catalogueService.listCategories();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">New listing</h1>
        <p className="mt-1 text-[15px] text-stone-500">Start with a category — you&apos;ll fill in the rest next.</p>
      </div>
      <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-6">
        <NewListingForm categories={categories} />
      </div>
    </div>
  );
}
