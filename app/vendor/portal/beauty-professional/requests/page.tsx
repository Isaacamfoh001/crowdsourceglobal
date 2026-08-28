import { redirect } from "next/navigation";
import { PageHeader } from "../../../../../components/ui/PageHeader";
import { Card } from "../../../../../components/ui/Card";
import { EmptyState } from "../../../../../components/ui/EmptyState";
import { BackLink } from "../../../../../components/ui/BackLink";
import { Pagination } from "../../../../../components/shared/Pagination";
import { ServiceRequestRow } from "../../../../../components/vendor-portal/ServiceRequestRow";
import { requireVendorPortalContext } from "../../../../../modules/vendors/policy";
import { beautyProfessionalsService } from "../../../../../modules/beauty-professionals/service";
import { serviceRequestsService } from "../../../../../modules/service-requests/service";
import { parsePage } from "../../../../../lib/pagination";

export const metadata = { title: "Service requests — Vendor Portal" };
export const dynamic = "force-dynamic";

/** Vendor Portal — incoming Beauty Services requests, newest-first (M22 §12/§16). Accept/decline here is the entire provider-side workflow — no chat, no counter-offer (prisma/schema.prisma's section header). */
export default async function VendorServiceRequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/beauty-professional/requests");
  const profile = await beautyProfessionalsService.getForVendor(vendorId);
  if (!profile) {
    redirect("/vendor/portal/beauty-professional");
  }

  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: requests, total, pageSize } = await serviceRequestsService.listForProfessional(profile.id, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/vendor/portal/beauty-professional" label="Back to profile" />
      <PageHeader title="Service requests" description={`${total} request${total === 1 ? "" : "s"} from customers.`} />

      {requests.length === 0 ? (
        <EmptyState title="No requests yet" description="Customer requests for your services will appear here." />
      ) : (
        <Card as="ul" padded={false} className="divide-y divide-ivory-100">
          {requests.map((request) => (
            <ServiceRequestRow key={request.id} request={request} />
          ))}
        </Card>
      )}

      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/vendor/portal/beauty-professional/requests" />
    </div>
  );
}
