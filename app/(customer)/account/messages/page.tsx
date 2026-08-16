import { ConversationList } from "../../../../components/messaging/ConversationList";
import { requireSession } from "../../../../modules/identity/policy";
import { identityService } from "../../../../modules/identity/service";
import { messagingService } from "../../../../modules/messaging/service";

export const metadata = { title: "Messages — Your account" };
export const dynamic = "force-dynamic";

export default async function CustomerMessagesPage() {
  const session = await requireSession("/account/messages");
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  const conversations = customerProfile ? await messagingService.listForCustomer(customerProfile.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-stone-900">Messages</h1>
        <p className="mt-1 text-[15px] text-stone-500">
          Conversations with CrownSourceGlobal about vendors, listings, or orders.
        </p>
      </div>
      <ConversationList
        conversations={conversations}
        basePath="/account/messages"
        emptyMessage="No conversations yet. Ask about an item from any listing page to get started."
      />
    </div>
  );
}
