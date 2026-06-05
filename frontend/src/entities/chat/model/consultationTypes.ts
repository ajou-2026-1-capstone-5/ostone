import type { ChatMessageResponse, ChatSessionResponse } from "@/shared/api/generated/zod";

export type ConsultationResponseMode = "AI_ACTIVE" | "HUMAN_ACTIVE" | "AI_ASSIST_ONLY";

export type ConsultationChatSession = Omit<
  ChatSessionResponse,
  "assignedCounselorId" | "responseMode"
> & {
  assignedCounselorId?: number | null;
  responseMode?: ConsultationResponseMode | null;
};

export type ConsultationChatMessage = ChatMessageResponse;
