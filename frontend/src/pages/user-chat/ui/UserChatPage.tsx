import { type FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  listDemoChatMessages,
  registerDemoChatSession,
  sendDemoChatMessage,
} from "@/entities/chat";
import type { ChatMessage, DemoChatSession } from "@/entities/chat";
import { ApiRequestError } from "@/shared/api";
import { useStomp } from "@/shared/lib/websocket";
import { ChatConversationScreen } from "./ChatConversationScreen";
import { ChatEntryScreen } from "./ChatEntryScreen";

function resolveSessionStartErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === "DOMAIN_PACK_CURRENT_VERSION_NOT_FOUND" || error.status === 404) {
      return "이 워크스페이스에는 운영 중인 도메인 팩 버전이 없습니다. 관리자에게 문의해 주세요.";
    }
    if (error.status === 401 || error.status === 403) {
      return "채팅을 시작할 권한이 없습니다. 다시 로그인 후 시도해 주세요.";
    }
  }
  return "채팅 세션을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

const DEMO_SESSION_STORAGE_PREFIX = "ostone:demo-chat-session";

function createStorageKey(workspaceId: number, customerName: string): string {
  const normalizedName = customerName.trim().toLowerCase();
  return `${DEMO_SESSION_STORAGE_PREFIX}:${workspaceId}:${encodeURIComponent(normalizedName)}`;
}

function isDemoChatSession(value: unknown): value is DemoChatSession {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<DemoChatSession>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.startedAt === "string" &&
    Array.isArray(candidate.messages)
  );
}

function isBackendRegisteredSession(session: DemoChatSession): boolean {
  return Number.isFinite(Number(session.id));
}

function readStoredSession(workspaceId: number, customerName: string): DemoChatSession | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(createStorageKey(workspaceId, customerName));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isDemoChatSession(parsed) && isBackendRegisteredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(
  workspaceId: number,
  customerName: string,
  session: DemoChatSession,
): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(createStorageKey(workspaceId, customerName), JSON.stringify(session));
}

interface RealtimeChatMessage {
  id: number | string;
  senderRole: string;
  content: string;
  createdAt: string;
}

function isRealtimeChatMessage(message: unknown): message is RealtimeChatMessage {
  if (!message || typeof message !== "object") return false;

  const candidate = message as Partial<RealtimeChatMessage>;
  return (
    (typeof candidate.id === "number" || typeof candidate.id === "string") &&
    typeof candidate.senderRole === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function toSenderType(senderRole: string): ChatMessage["senderType"] {
  if (senderRole === "USER" || senderRole === "CUSTOMER") return "USER";
  if (senderRole === "AGENT" || senderRole === "COUNSELOR") return "AGENT";
  return "BOT";
}

function toRealtimeChatMessage(
  message: RealtimeChatMessage,
  sessionId: number,
  customerName: string,
): ChatMessage {
  const senderType = toSenderType(message.senderRole);
  return {
    id: String(message.id),
    sessionId,
    content: message.content,
    senderType,
    senderName: senderType === "USER" ? customerName : undefined,
    createdAt: message.createdAt,
  };
}

function compareMessageCreatedAt(a: ChatMessage, b: ChatMessage): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function mergeMessages(currentMessages: ChatMessage[], nextMessages: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  [...currentMessages, ...nextMessages].forEach((message) => {
    byId.set(message.id, message);
  });
  return Array.from(byId.values()).sort(compareMessageCreatedAt);
}

function withCustomerNames(messages: ChatMessage[], customerName: string): ChatMessage[] {
  return messages.map((message) =>
    message.senderType === "USER" ? { ...message, senderName: customerName } : message,
  );
}

function getNumericSessionId(sessionId: string): number | null {
  const numericSessionId = Number(sessionId);
  return Number.isFinite(numericSessionId) ? numericSessionId : null;
}

function mergePersistedMessages(
  currentMessages: ChatMessage[],
  persistedMessages: ChatMessage[],
): ChatMessage[] {
  const optimisticMessages = currentMessages.filter((message) => message.id.startsWith("local-"));
  return mergeMessages(optimisticMessages, persistedMessages);
}

async function getOrCreateStoredSession(
  workspaceId: number,
  customerName: string,
): Promise<DemoChatSession> {
  const storedSession = readStoredSession(workspaceId, customerName);
  if (storedSession) return storedSession;

  const nextSession = await registerDemoChatSession(workspaceId, customerName);
  writeStoredSession(workspaceId, customerName, nextSession);
  return nextSession;
}

export function UserChatPage() {
  const { workspaceId: raw } = useParams<{ workspaceId: string }>();
  const workspaceId = Number(raw);
  const { connectionStatus, subscribe } = useStomp();
  const [draftName, setDraftName] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const nameRequestIdRef = useRef(0);
  const [chatState, setChatState] = useState<{
    workspaceId: number | null;
    customerName: string | null;
    session: DemoChatSession | null;
    error: string | null;
  }>({ workspaceId: null, customerName: null, session: null, error: null });
  const isInvalidWorkspace = !raw || Number.isNaN(workspaceId);
  const activeChatState =
    chatState.workspaceId === workspaceId && chatState.customerName === customerName
      ? chatState
      : { session: null, error: null };
  const activeSessionId = activeChatState.session?.id ?? null;

  const handleNameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextName = draftName.trim();
    if (!nextName) {
      setNameError("이름을 입력해 주세요.");
      return;
    }

    const requestId = ++nameRequestIdRef.current;
    setNameError(null);
    setCustomerName(nextName);
    setChatState({ workspaceId, customerName: nextName, session: null, error: null });
    try {
      const nextSession = await getOrCreateStoredSession(workspaceId, nextName);
      if (requestId !== nameRequestIdRef.current) return;
      setChatState({ workspaceId, customerName: nextName, session: nextSession, error: null });
    } catch (error) {
      console.error("Failed to start demo chat session", error);
      if (requestId !== nameRequestIdRef.current) return;
      setChatState({
        workspaceId,
        customerName: nextName,
        session: null,
        error: resolveSessionStartErrorMessage(error),
      });
    }
  };

  const handleResetToNameForm = () => {
    nameRequestIdRef.current += 1;
    setCustomerName(null);
    setDraftName("");
    setNameError(null);
    setChatState({ workspaceId: null, customerName: null, session: null, error: null });
  };

  const handleSendMessage = async (content: string) => {
    const activeSession = activeChatState.session;
    if (!activeSession || !customerName || isSending) return;

    const now = new Date().toISOString();
    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      sessionId: 0,
      content,
      senderType: "USER",
      senderName: customerName,
      createdAt: now,
    };

    setMessageError(null);
    setIsSending(true);
    setChatState((current) => {
      if (current.session?.id !== activeSession.id) return current;
      const nextSession = {
        ...activeSession,
        messages: [...activeSession.messages, userMessage],
      };
      writeStoredSession(workspaceId, customerName, nextSession);
      return {
        ...current,
        session: nextSession,
      };
    });

    try {
      const savedMessages = await sendDemoChatMessage(workspaceId, activeSession.id, content);
      const namedMessages = savedMessages.map((message) =>
        message.senderType === "USER" ? { ...message, senderName: customerName } : message,
      );

      setChatState((current) => {
        if (current.session?.id !== activeSession.id) return current;
        const nextSession = {
          ...current.session,
          messages: [
            ...current.session.messages.filter((message) => message.id !== userMessage.id),
            ...namedMessages,
          ],
        };
        writeStoredSession(workspaceId, customerName, nextSession);
        return {
          ...current,
          session: nextSession,
        };
      });
    } catch {
      setChatState((current) => {
        if (current.session?.id !== activeSession.id) return current;
        const nextSession = {
          ...current.session,
          messages: current.session.messages.filter((message) => message.id !== userMessage.id),
        };
        writeStoredSession(workspaceId, customerName, nextSession);
        return {
          ...current,
          session: nextSession,
        };
      });
      setMessageError("응답을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!activeSessionId || !customerName) return;
    const numericSessionId = getNumericSessionId(activeSessionId);
    if (numericSessionId == null) return;

    let cancelled = false;

    const syncMessages = async () => {
      try {
        const persistedMessages = await listDemoChatMessages(workspaceId, activeSessionId);
        if (cancelled) return;
        const namedMessages = withCustomerNames(persistedMessages, customerName);
        setChatState((current) => {
          if (current.session?.id !== activeSessionId || current.customerName !== customerName) {
            return current;
          }
          const nextSession = {
            ...current.session,
            messages: mergePersistedMessages(current.session.messages, namedMessages),
          };
          writeStoredSession(workspaceId, customerName, nextSession);
          return {
            ...current,
            session: nextSession,
          };
        });
      } catch {
        // Demo chat remains usable through the send response even if background sync fails.
      }
    };

    void syncMessages();
    const intervalId = window.setInterval(() => {
      void syncMessages();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeSessionId, customerName, workspaceId]);

  useEffect(() => {
    if (!activeSessionId || !customerName || connectionStatus !== "CONNECTED") return;
    const numericSessionId = getNumericSessionId(activeSessionId);
    if (numericSessionId == null) return;

    return subscribe(`/topic/chat.${numericSessionId}`, (raw) => {
      if (!isRealtimeChatMessage(raw)) return;

      const nextMessage = toRealtimeChatMessage(raw, numericSessionId, customerName);
      setChatState((current) => {
        if (current.session?.id !== activeSessionId || current.customerName !== customerName) {
          return current;
        }
        const nextSession = {
          ...current.session,
          messages: mergeMessages(current.session.messages, [nextMessage]),
        };
        writeStoredSession(workspaceId, customerName, nextSession);
        return {
          ...current,
          session: nextSession,
        };
      });
    });
  }, [activeSessionId, connectionStatus, customerName, subscribe, workspaceId]);

  if (isInvalidWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-8 text-sm text-black">
        유효하지 않은 워크스페이스입니다.
      </div>
    );
  }

  if (!customerName) {
    return (
      <ChatEntryScreen
        draftName={draftName}
        nameError={nameError}
        workspaceId={workspaceId}
        onDraftChange={setDraftName}
        onSubmit={handleNameSubmit}
      />
    );
  }

  if (activeChatState.error) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-white p-8 text-black"
        role="alert"
      >
        <div className="w-full max-w-[420px]">
          <h1 className="text-[20px] font-medium text-black">채팅을 시작할 수 없습니다</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">{activeChatState.error}</p>
          <button
            type="button"
            onClick={handleResetToNameForm}
            className="mt-6 h-12 w-full rounded-full bg-black px-5 text-sm text-white"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!activeChatState.session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-8 text-sm text-gray-500">
        채팅방을 여는 중입니다...
      </div>
    );
  }

  return (
    <ChatConversationScreen
      session={activeChatState.session}
      customerName={customerName}
      isSending={isSending}
      messageError={messageError}
      onSend={(content) => {
        void handleSendMessage(content);
      }}
    />
  );
}
