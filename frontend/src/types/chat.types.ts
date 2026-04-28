export interface ChatMessageType {
  id: number;
  licitacao_id: number;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
}

export interface ChatConversationResponseType {
  messages: ChatMessageType[];
}
