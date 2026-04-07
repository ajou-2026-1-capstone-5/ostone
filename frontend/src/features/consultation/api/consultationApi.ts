import { apiClient } from '../../../shared/api';

export interface ChatSession {
  id: number;
  status: string;
  channel: string;
  metaJson: string; // JSON 형태의 문자열
  startedAt: string;
}

export interface ChatMessage {
  id: number;
  seqNo: number;
  senderRole: string; // 'CUSTOMER', 'SYSTEM', 'AGENT', 'NOTE'
  messageType: string;
  content: string;
  createdAt: string;
}

export const consultationApi = {
  getQueue: async (): Promise<ChatSession[]> => {
    return apiClient.get<ChatSession[]>('/consultation/queue');
  },

  getMessages: async (sessionId: number): Promise<ChatMessage[]> => {
    return apiClient.get<ChatMessage[]>(`/consultation/sessions/${sessionId}/messages`);
  },

  sendMessage: async (sessionId: number, content: string, isNote: boolean = false): Promise<ChatMessage> => {
    return apiClient.post<ChatMessage>(`/consultation/sessions/${sessionId}/messages`, { content, isNote });
  },

  updateStatus: async (sessionId: number, status: string): Promise<ChatSession> => {
    return apiClient.patch<ChatSession>(`/consultation/sessions/${sessionId}/status`, { status });
  }
};
