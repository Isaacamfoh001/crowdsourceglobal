import { notFound } from "next/navigation";
import Link from "next/link";
import { MessageThread } from "../../../../../components/messaging/MessageThread";
import { requireAdminSession } from "../../../../../modules/administration/policy";
import { messagingService } from "../../../../../modules/messaging/service";
import { adminReplyAction } from "../../../../../lib/actions/admin";

type Params = { id: string };

export const metadata = { title: "Conversation — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminConversationPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  await requireAdminSession("/admin/messages", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const conversation = await messagingService.getForAdmin(id);

  if (!conversation) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/messages" className="text-sm font-medium text-forest-800 hover:underline">
        ← All messages
      </Link>
      <div>
        <h1 className="font-display text-xl font-medium text-espresso-950">
          {conversation.participantType === "CUSTOMER" ? "Customer" : "Vendor"} conversation
        </h1>
        <p className="text-sm text-espresso-900/50">{conversation.contextLabel}</p>
      </div>
      <MessageThread
        conversationId={conversation.id}
        messages={conversation.messages}
        selfIsStaff
        replyAction={adminReplyAction}
      />
    </div>
  );
}
