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
  const [session, setSession] = useState<ChatSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;

    createChatSession(workspaceId)
      .then((nextSession) => {
        if (!cancelled) setSession(nextSession);
      })
      .catch(() => {
        if (!cancelled) setError("채팅 세션을 시작할 수 없습니다.");
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (error) {
    return <div className="flex h-full items-center justify-center p-8 text-sm">{error}</div>;
  }

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
        채팅방을 여는 중입니다...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatRoom sessionId={session.id} />
    </div>
  );
}
