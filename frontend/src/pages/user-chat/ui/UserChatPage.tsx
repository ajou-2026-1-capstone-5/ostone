import { type FormEvent, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { registerDemoChatSession, sendDemoChatMessage } from "@/entities/chat";
import type { ChatMessage, DemoChatSession } from "@/entities/chat";
import { ConnectionStatus, MessageInput, MessageList } from "@/features/user-chat";
import { ApiRequestError } from "@/shared/api";

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

  if (isInvalidWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-8 text-sm text-black">
        유효하지 않은 워크스페이스입니다.
      </div>
    );
  }

  if (!customerName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-8 text-black">
        <form
          onSubmit={handleNameSubmit}
          className="w-full max-w-[360px]"
          aria-label="채팅 사용자 이름 입력"
        >
          <h1 className="text-[22px] font-medium text-black">사용자 채팅</h1>
          <label className="mt-6 block text-sm text-black" htmlFor="chat-customer-name">
            이름
          </label>
          <input
            id="chat-customer-name"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            className="mt-2 h-12 w-full rounded-full border border-gray-300 bg-white px-5 text-sm text-black outline-none focus:border-black focus:ring-2 focus:ring-black/10"
            placeholder="이름을 입력하세요"
            autoComplete="name"
          />
          {nameError && <p className="mt-2 text-xs text-red-600">{nameError}</p>}
          <button
            type="submit"
            className="mt-5 h-12 w-full rounded-full bg-black px-5 text-sm text-white"
          >
            채팅 시작
          </button>
        </form>
      </div>
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
    <div
      className="flex h-screen min-h-0 flex-col overflow-hidden bg-white"
      style={{ padding: "20px 24px 24px" }}
    >
      <header
        className="flex shrink-0 items-center justify-between border-b border-gray-200"
        style={{ padding: "0 0 16px" }}
      >
        <div>
          <h1 className="text-[18px] font-medium text-black">사용자 채팅</h1>
          <p className="mt-1 text-xs text-gray-500">
            {customerName} · Session #{activeChatState.session.id}
          </p>
        </div>
        <span className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600">
          {activeChatState.session.status}
        </span>
      </header>
      <div className="min-h-0 flex-1" style={{ paddingTop: 16 }}>
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <ConnectionStatus status="CONNECTED" />
          <div className="min-h-0 flex-1 border-y border-gray-100">
            <MessageList messages={activeChatState.session.messages} />
          </div>
          {messageError && (
            <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
              {messageError}
            </div>
          )}
          <MessageInput
            onSend={(content) => {
              void handleSendMessage(content);
            }}
            disabled={isSending}
          />
        </section>
      </div>
    </div>
  );
}
