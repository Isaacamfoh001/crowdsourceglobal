import { serializeDate } from "../response";
import type { ConversationDetail, ConversationSummary, MessageView } from "../../../modules/messaging/types";

/**
 * Mobile M30 messaging DTOs — mirror `modules/messaging/types.ts` exactly.
 * No new fields, no new business logic: these mappers only serialize what
 * `messagingService`'s existing customer/vendor-scoped read methods
 * already return (the same rows the web `ConversationList`/`MessageThread`
 * components render from).
 */

export function toConversationSummaryDTO(row: ConversationSummary) {
  return {
    id: row.id,
    participantType: row.participantType,
    contextType: row.contextType,
    status: row.status,
    contextLabel: row.contextLabel,
    lastMessage: row.lastMessage,
    updatedAt: serializeDate(row.updatedAt),
    createdAt: serializeDate(row.createdAt),
  };
}

function toMessageDTO(row: MessageView) {
  return {
    id: row.id,
    body: row.body,
    senderIsStaff: row.senderIsStaff,
    senderName: row.senderName,
    createdAt: serializeDate(row.createdAt),
  };
}

export function toConversationDetailDTO(row: ConversationDetail) {
  return {
    ...toConversationSummaryDTO(row),
    messages: row.messages.map(toMessageDTO),
  };
}
