import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { EmptyState } from "../ui/EmptyState";
import type { ConversationSummary } from "../../modules/messaging/types";

export function ConversationList({
  conversations,
  basePath,
  emptyMessage,
  showCounterparty = false,
}: {
  conversations: (ConversationSummary & { counterpartyName?: string })[];
  basePath: string;
  emptyMessage: string;
  showCounterparty?: boolean;
}) {
  if (conversations.length === 0) {
    return <EmptyState icon={MessagesSquare} title="No conversations yet" description={emptyMessage} />;
  }

  return (
    <div className="divide-y divide-ivory-100 rounded-lg border border-ivory-300 bg-ivory-50">
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          href={`${basePath}/${conversation.id}`}
          className="flex flex-col gap-1 px-5 py-4 hover:bg-ivory-50"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-espresso-950">
              {showCounterparty && conversation.counterpartyName ? conversation.counterpartyName : conversation.contextLabel}
            </p>
            {conversation.status === "OPEN" ? (
              <span className="shrink-0 rounded-full bg-champagne-200 px-2 py-0.5 text-[11px] font-semibold text-espresso-900">
                Open
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-ivory-100 px-2 py-0.5 text-[11px] font-semibold text-espresso-900/50">
                Closed
              </span>
            )}
          </div>
          {showCounterparty ? <p className="text-xs text-espresso-900/35">{conversation.contextLabel}</p> : null}
          {conversation.lastMessage ? (
            <p className="truncate text-sm text-espresso-900/50">{conversation.lastMessage}</p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
