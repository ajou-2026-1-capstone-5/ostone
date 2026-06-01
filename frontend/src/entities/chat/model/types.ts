export interface ChatMessage {
  id: string;
  sessionId: number;
  content: string;
  senderType: "USER" | "BOT" | "AGENT" | "SYSTEM";
  senderId?: number;
  senderName?: string;
  createdAt: string;
}

export interface ChatSession {
  id: number;
  status: "OPEN" | "ACTIVE" | "RESOLVED" | "COMPLETED";
  channel: string;
  metaJson?: string;
  startedAt: string;
  assignedCounselorId?: number | null;
  endedAt?: string | null;
}

export type ConnectionStatus = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
