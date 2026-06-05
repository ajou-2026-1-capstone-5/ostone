import { useEffect, useRef } from "react";
import { useStomp, type ConnectionStatus } from "@/shared/lib/websocket";

type UseConsultationRealtimeParams = {
  workspaceId: number | null;
  activeCustomerId: string | null;
  hasQueueLoaded: boolean;
  onQueueEvent: (raw: unknown) => void;
  onChatMessage: (raw: unknown, sessionId: string) => void;
  onServerError: (error: unknown) => void;
  onReconnect: () => void;
  onChatUnsubscribe: () => void;
};

export function useConsultationRealtime({
  workspaceId,
  activeCustomerId,
  hasQueueLoaded,
  onQueueEvent,
  onChatMessage,
  onServerError,
  onReconnect,
  onChatUnsubscribe,
}: UseConsultationRealtimeParams) {
  const previousConnectionStatusRef = useRef<ConnectionStatus>("DISCONNECTED");
  const { connectionStatus, subscribe, sendTo } = useStomp({ onServerError });

  useEffect(() => {
    const previousStatus = previousConnectionStatusRef.current;
    previousConnectionStatusRef.current = connectionStatus;

    if (!workspaceId) return;
    if (connectionStatus !== "CONNECTED" || previousStatus === "CONNECTED") return;
    if (!hasQueueLoaded) return;

    onReconnect();
  }, [connectionStatus, hasQueueLoaded, onReconnect, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;

    const unsubscribe = subscribe(
      `/topic/workspaces.${workspaceId}.consultation.queue`,
      onQueueEvent,
    );

    return () => {
      unsubscribe();
    };
  }, [onQueueEvent, subscribe, workspaceId]);

  useEffect(() => {
    if (!activeCustomerId) return;

    const topic = `/topic/chat.${activeCustomerId}`;
    const unsubscribe = subscribe(topic, (raw) => onChatMessage(raw, activeCustomerId));

    return () => {
      unsubscribe();
      onChatUnsubscribe();
    };
  }, [activeCustomerId, onChatMessage, onChatUnsubscribe, subscribe]);

  return {
    connectionStatus,
    sendTo,
  };
}
