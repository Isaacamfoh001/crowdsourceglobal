import { redirect } from "next/navigation";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { EmptyState } from "../../../../../components/ui/EmptyState";
import { BackLink } from "../../../../../components/ui/BackLink";
import { BeautyServiceForm } from "../../../../../components/vendor-portal/BeautyServiceForm";
import { BeautyServiceRow } from "../../../../../components/vendor-portal/BeautyServiceRow";
import { requireVendorPortalContext } from "../../../../../modules/vendors/policy";
import { beautyProfessionalsService } from "../../../../../modules/beauty-professionals/service";
import { beautyServicesService } from "../../../../../modules/beauty-services/service";
import { explorePostsService } from "../../../../../modules/explore-posts/service";

export const metadata = { title: "Services — Vendor Portal" };
export const dynamic = "force-dynamic";

/** Vendor Portal — manage offered BeautyService rows (M22 §7/§16). */
export default async function VendorBeautyServicesPage() {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional/services");
  const profile = await beautyProfessionalsService.getForVendor(vendorId);
  if (!profile) {
    redirect("/vendor/portal/beauty-professional");
  }

  const [services, categories] = await Promise.all([beautyServicesService.listForVendor(vendorId), explorePostsService.listCategories()]);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/vendor/portal/beauty-professional" label="Back to profile" />
      <PageHeader title="Services" description="What you offer and their indicative starting price." />

      <Card>
        <h2 className="mb-4 font-display text-lg font-medium text-espresso-950">Add a service</h2>
        <BeautyServiceForm categories={categories} />
      </Card>

      {services.length === 0 ? (
        <EmptyState title="No services yet" description="Add your first service above." />
      ) : (
        <Card as="ul" padded={false} className="divide-y divide-ivory-100">
          {services.map((service) => (
            <BeautyServiceRow key={service.id} service={service} categories={categories} />
          ))}
        </Card>
      )}
    </div>
  );
}
