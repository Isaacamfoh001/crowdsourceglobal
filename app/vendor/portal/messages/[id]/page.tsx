import { notFound } from "next/navigation";
import Link from "next/link";
import { MessageThread } from "../../../../../components/messaging/MessageThread";
import { requireVendorPortalContext } from "../../../../../modules/vendors/policy";
import { messagingService } from "../../../../../modules/messaging/service";
import { vendorReplyAction } from "../../../../../lib/actions/messaging";

type Params = { id: string };

export const metadata = { title: "Conversation — Vendor Portal" };
export const dynamic = "force-dynamic";

export default async function VendorConversationPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const { vendorId } = await requireVendorPortalContext(`/vendor/portal/messages/${id}`);
  const conversation = await messagingService.getForVendor(vendorId, id);

  if (!conversation) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/vendor/portal/messages" className="text-sm font-medium text-brand-700 hover:underline">
        ← All messages
      </Link>
      <h1 className="font-display text-xl font-medium text-stone-900">CrownSourceGlobal support</h1>
      <MessageThread
        conversationId={conversation.id}
        messages={conversation.messages}
        selfIsStaff={false}
        replyAction={vendorReplyAction}
      />
    </div>
  );
}
