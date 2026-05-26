import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { createChatSession } from "@/entities/chat";
import type { ChatSession } from "@/entities/chat";
import { ChatRoom } from "@/features/user-chat";
import type { ShellContext } from "@/shared/ui/ostone/chrome";

export function UserChatPage() {
  useOutletContext<ShellContext>();
  const { workspaceId: raw } = useParams<{ workspaceId: string }>();
  const workspaceId = Number(raw);
  const [chatState, setChatState] = useState<{
    workspaceId: number | null;
    session: ChatSession | null;
    error: string | null;
  }>({ workspaceId: null, session: null, error: null });
  const isInvalidWorkspace = !raw || Number.isNaN(workspaceId);
  const activeChatState =
    chatState.workspaceId === workspaceId ? chatState : { session: null, error: null };

  useEffect(() => {
    if (isInvalidWorkspace) return;

    let cancelled = false;

    (async () => {
      try {
        const nextSession = await createChatSession(workspaceId);
        if (!cancelled) {
          setChatState({ workspaceId, session: nextSession, error: null });
        }
      } catch {
        if (!cancelled) {
          setChatState({
            workspaceId,
            session: null,
            error: "채팅 세션을 시작할 수 없습니다.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isInvalidWorkspace, workspaceId]);

  if (isInvalidWorkspace) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm">
        유효하지 않은 워크스페이스입니다.
      </div>
    );
  }

  if (activeChatState.error) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm">
        {activeChatState.error}
      </div>
    );
  }

  if (!activeChatState.session) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
        채팅방을 여는 중입니다...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatRoom sessionId={activeChatState.session.id} />
    </div>
  );
}
