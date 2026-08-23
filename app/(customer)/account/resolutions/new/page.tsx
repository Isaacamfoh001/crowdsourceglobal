import { notFound } from "next/navigation";
import { requireSession, getCurrentCustomerProfile } from "../../../../../modules/identity/policy";
import { resolutionsService } from "../../../../../modules/resolutions/service";
import { ReportProblemForm } from "../../../../../components/resolutions/ReportProblemForm";

export const metadata = { title: "Report a problem" };
export const dynamic = "force-dynamic";

export default async function NewResolutionPage({ searchParams }: { searchParams: Promise<{ orderId?: string; fulfilmentId?: string }> }) {
  const { orderId, fulfilmentId } = await searchParams;
  const session = await requireSession(`/account/resolutions/new${orderId ? `?orderId=${orderId}` : ""}`);
  const customerProfile = await getCurrentCustomerProfile(session.user.id);
  if (!customerProfile || !orderId) notFound();

  const context = await resolutionsService.getOrderContextForCustomer(orderId, customerProfile.id);
  if (!context) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-espresso-950">Report a problem</h1>
        <p className="mt-1 text-sm text-espresso-900/50">Order {context.orderNumber} — CrownSourceGlobal will review this and get back to you.</p>
      </div>
      <ReportProblemForm context={context} defaultFulfilmentId={fulfilmentId} />
    </div>
  );
}
