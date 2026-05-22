import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { toast } from "sonner";
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
    setError(null);
    setSession(null);

    if (!raw || Number.isNaN(workspaceId)) {
      setError("유효하지 않은 워크스페이스입니다.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const nextSession = await createChatSession(workspaceId);
        if (!cancelled) setSession(nextSession);
      } catch {
        if (!cancelled) {
          setError("채팅 세션을 시작할 수 없습니다.");
          toast.error("채팅 세션을 시작할 수 없습니다.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [raw, workspaceId]);

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
