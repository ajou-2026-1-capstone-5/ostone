export interface ChatMessage {
  id: string;
  sessionId: number;
  content: string;
  senderType: "USER" | "BOT" | "AGENT";
  senderId?: number;
  senderName?: string;
  createdAt: string;
}

export interface ChatSession {
  id: number;
  workspaceId: number;
  status: "ACTIVE" | "CLOSED";
  createdAt: string;
}

export type ConnectionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
