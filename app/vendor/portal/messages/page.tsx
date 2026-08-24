import { ConversationList } from "../../../../components/messaging/ConversationList";
import { Pagination } from "../../../../components/shared/Pagination";
import { StartVendorConversationForm } from "../../../../components/vendor-portal/StartVendorConversationForm";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { messagingService } from "../../../../modules/messaging/service";
import { parsePage } from "../../../../lib/pagination";

export const metadata = { title: "Messages — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorMessagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/messages");
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: conversations, total, pageSize } = await messagingService.listForVendor(vendorId, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-espresso-950">Messages</h1>

      <div className="rounded-lg border border-ivory-300 bg-ivory-50 p-5">
        <h2 className="text-sm font-semibold text-espresso-950">Contact CrownSourceGlobal</h2>
        <div className="mt-3">
          <StartVendorConversationForm />
        </div>
      </div>

      <ConversationList
        conversations={conversations}
        basePath="/vendor/portal/messages"
        emptyMessage="No conversations with CrownSourceGlobal yet."
      />
      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/vendor/portal/messages" />
    </div>
  );
}
