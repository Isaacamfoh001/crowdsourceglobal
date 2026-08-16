export type ConversationParticipantType = "CUSTOMER" | "VENDOR";
export type ConversationContextType = "LISTING" | "VENDOR" | "ORDER" | "GENERAL";
export type ConversationStatus = "OPEN" | "CLOSED";

export type MessageView = {
  id: string;
  body: string;
  senderIsStaff: boolean;
  senderName: string;
  createdAt: Date;
};

export type ConversationSummary = {
  id: string;
  participantType: ConversationParticipantType;
  contextType: ConversationContextType;
  status: ConversationStatus;
  contextLabel: string;
  lastMessage: string | null;
  updatedAt: Date;
  createdAt: Date;
};

export type ConversationDetail = ConversationSummary & {
  messages: MessageView[];
};

export type AdminConversationSummary = ConversationSummary & {
  counterpartyName: string;
};
