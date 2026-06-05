export {
  createChatSession,
  createDemoChatSession,
  createFreshChatSession,
  listChatMessages,
  listDemoChatMessages,
  registerDemoChatSession,
  sendDemoChatMessage,
} from "@/entities/chat/api/chatApi";
export type { DemoChatSession } from "@/entities/chat/api/chatApi";
export type { ChatMessage, ChatSession, ConnectionStatus } from "@/entities/chat/model/types";
export type {
  ConsultationChatMessage,
  ConsultationChatSession,
  ConsultationResponseMode,
} from "@/entities/chat/model/consultationTypes";
