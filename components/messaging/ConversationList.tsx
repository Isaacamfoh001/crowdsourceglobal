import Link from "next/link";
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
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
        <p className="text-sm text-stone-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          href={`${basePath}/${conversation.id}`}
          className="flex flex-col gap-1 px-5 py-4 hover:bg-stone-50"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-stone-900">
              {showCounterparty && conversation.counterpartyName ? conversation.counterpartyName : conversation.contextLabel}
            </p>
            {conversation.status === "OPEN" ? (
              <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
                Open
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-500">
                Closed
              </span>
            )}
          </div>
          {showCounterparty ? <p className="text-xs text-stone-400">{conversation.contextLabel}</p> : null}
          {conversation.lastMessage ? (
            <p className="truncate text-sm text-stone-500">{conversation.lastMessage}</p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
