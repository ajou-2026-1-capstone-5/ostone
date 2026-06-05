export interface ChatMessage {
  id: string;
  sessionId: number;
  content: string;
  senderType: "USER" | "BOT" | "AGENT" | "SYSTEM";
  senderId?: number;
  senderName?: string;
  /**
   * 서버가 확정한 메시지 순서값. 정렬 1순위로 사용한다. optimistic(local)
   * 메시지처럼 서버 확정 전 메시지에는 없을 수 있다.
   */
  seqNo?: number;
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
