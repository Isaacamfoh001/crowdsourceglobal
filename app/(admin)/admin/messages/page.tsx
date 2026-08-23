import { ConversationList } from "../../../../components/messaging/ConversationList";
import { requireAdminSession } from "../../../../modules/administration/policy";
import { messagingService } from "../../../../modules/messaging/service";
import { parsePage } from "../../../../lib/pagination";
import { Pagination } from "../../../../components/shared/Pagination";
import { PageHeader } from "../../../../components/ui/PageHeader";

export const metadata = { title: "Messages — Admin" };
export const dynamic = "force-dynamic";

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminSession("/admin/messages", ["SUPER_ADMIN", "OPS_ADMIN"]);
  const { page } = await searchParams;
  const currentPage = parsePage(page);
  const { rows: conversations, total, pageSize } = await messagingService.listForAdmin(undefined, currentPage);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Messages" description={`${total} conversation${total === 1 ? "" : "s"}.`} />
      <ConversationList
        conversations={conversations}
        basePath="/admin/messages"
        emptyMessage="No conversations yet."
        showCounterparty
      />
      <Pagination currentPage={currentPage} total={total} pageSize={pageSize} basePath="/admin/messages" />
    </div>
  );
}
