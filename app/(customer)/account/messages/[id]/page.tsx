import { notFound } from "next/navigation";
import Link from "next/link";
import { MessageThread } from "../../../../../components/messaging/MessageThread";
import { requireSession } from "../../../../../modules/identity/policy";
import { identityService } from "../../../../../modules/identity/service";
import { messagingService } from "../../../../../modules/messaging/service";
import { customerReplyAction } from "../../../../../lib/actions/messaging";

type Params = { id: string };

export const metadata = { title: "Conversation — Your account" };
export const dynamic = "force-dynamic";

export default async function CustomerConversationPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const session = await requireSession(`/account/messages/${id}`);
  const customerProfile = await identityService.getCustomerProfileByUserId(session.user.id);
  if (!customerProfile) notFound();

  const conversation = await messagingService.getForCustomer(customerProfile.id, id);
  if (!conversation) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/account/messages" className="text-sm font-medium text-brand-700 hover:underline">
        ← All messages
      </Link>
      <div>
        <h1 className="font-display text-xl font-medium text-stone-900">CrownSourceGlobal support</h1>
        <p className="text-sm text-stone-500">{conversation.contextLabel}</p>
      </div>
      <MessageThread
        conversationId={conversation.id}
        messages={conversation.messages}
        selfIsStaff={false}
        replyAction={customerReplyAction}
      />
    </div>
  );
}
