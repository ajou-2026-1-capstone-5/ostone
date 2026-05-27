export type ChatSenderRole =
  | "USER"
  | "CUSTOMER"
  | "AGENT"
  | "COUNSELOR"
  | "ASSISTANT"
  | "NOTE"
  | "SYSTEM";

type RoleTone = "customer" | "counselor" | "assistant" | "note" | "system";

export interface ChatRolePresentation {
  role: ChatSenderRole;
  label: string;
  avatar: string;
  tone: RoleTone;
}

const ROLE_PRESENTATION: Record<ChatSenderRole, ChatRolePresentation> = {
  USER: { role: "USER", label: "고객", avatar: "고", tone: "customer" },
  CUSTOMER: { role: "CUSTOMER", label: "고객", avatar: "고", tone: "customer" },
  AGENT: { role: "AGENT", label: "상담사", avatar: "C", tone: "counselor" },
  COUNSELOR: { role: "COUNSELOR", label: "상담사", avatar: "C", tone: "counselor" },
  ASSISTANT: { role: "ASSISTANT", label: "AI", avatar: "A", tone: "assistant" },
  NOTE: { role: "NOTE", label: "내부 메모", avatar: "N", tone: "note" },
  SYSTEM: { role: "SYSTEM", label: "시스템", avatar: "S", tone: "system" },
};

export function normalizeChatSenderRole(senderRole?: string | null): ChatSenderRole {
  if (senderRole && senderRole in ROLE_PRESENTATION) {
    return senderRole as ChatSenderRole;
  }
  return "SYSTEM";
}

export function getChatRolePresentation(senderRole?: string | null): ChatRolePresentation {
  return ROLE_PRESENTATION[normalizeChatSenderRole(senderRole)];
}

export function isCounselorLikeRole(senderRole?: string | null): boolean {
  const tone = getChatRolePresentation(senderRole).tone;
  return tone === "counselor" || tone === "assistant";
}
