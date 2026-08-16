import { ConversationList } from "../../../../components/messaging/ConversationList";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { messagingService } from "../../../../modules/messaging/service";

export const metadata = { title: "Messages — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  await requireAdminSession("/admin/messages", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const conversations = await messagingService.listForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-medium text-stone-900">Messages</h1>
      <ConversationList
        conversations={conversations}
        basePath="/admin/messages"
        emptyMessage="No conversations yet."
        showCounterparty
      />
    </div>
  );
}
