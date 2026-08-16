import { ConversationList } from "../../../../components/messaging/ConversationList";
import { StartVendorConversationForm } from "../../../../components/vendor-portal/StartVendorConversationForm";
import { requireVendorPortalContext } from "../../../../modules/vendors/policy";
import { messagingService } from "../../../../modules/messaging/service";

export const metadata = { title: "Messages — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorMessagesPage() {
  const { vendorId } = await requireVendorPortalContext("/vendor/portal/messages");
  const conversations = await messagingService.listForVendor(vendorId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-stone-900">Messages</h1>

      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-stone-900">Contact CrownSourceGlobal</h2>
        <div className="mt-3">
          <StartVendorConversationForm />
        </div>
      </div>

      <ConversationList
        conversations={conversations}
        basePath="/vendor/portal/messages"
        emptyMessage="No conversations with CrownSourceGlobal yet."
      />
    </div>
  );
}
