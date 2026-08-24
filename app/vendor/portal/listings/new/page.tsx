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
        <h1 className="font-display text-2xl font-medium text-espresso-950">New listing</h1>
        <p className="mt-1 text-[15px] text-espresso-900/50">Start with a category — you&apos;ll fill in the rest next.</p>
      </div>
      <div className="max-w-md rounded-lg border border-ivory-300 bg-ivory-50 p-6">
        <NewListingForm categories={categories} />
      </div>
    </div>
  );
}
