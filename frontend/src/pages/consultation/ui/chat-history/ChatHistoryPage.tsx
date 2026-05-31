import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useChatSessions } from "../../../../features/consultation/api/chatHistoryApi";
import { MessageHistory } from "../../../../features/consultation/ui/chat-history/MessageHistory";
import { SessionList } from "../../../../features/consultation/ui/chat-history/SessionList";
import { parseRouteId } from "../../../../shared/lib/parseRouteId";
import styles from "./ChatHistoryPage.module.css";

interface ChatHistoryPageProps {
  workspaceId?: number;
}

export function ChatHistoryPage({ workspaceId: workspaceIdProp }: ChatHistoryPageProps) {
  const navigate = useNavigate();
  const { workspaceId: workspaceIdParam, sessionId: sessionIdParam } = useParams<{
    workspaceId: string;
    sessionId: string;
  }>();
  const workspaceId = workspaceIdProp ?? parseRouteId(workspaceIdParam);
  const selectedSessionId = sessionIdParam ?? null;
  const {
    data: sessions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useChatSessions({
    workspaceId,
  });
  const historySessions = useMemo(
    () =>
      sessions.filter(
        (session) => session.status === "COMPLETED" || session.status === "RESOLVED",
      ),
    [sessions],
  );
  const selectableSessionIds = useMemo(
    () =>
      new Set(
        historySessions
          .filter((session) => session.id != null)
          .map((session) => String(session.id)),
      ),
    [historySessions],
  );
  const hasSelectedSession =
    selectedSessionId !== null && selectableSessionIds.has(selectedSessionId);
  const isSelectionPending = selectedSessionId !== null && isLoading;
  const missingSessionId =
    selectedSessionId !== null && !isLoading && !isError && !hasSelectedSession
      ? selectedSessionId
      : null;

  const handleSelectSession = (sessionId: string) => {
    if (workspaceId === null) return;
    navigate(`/workspaces/${workspaceId}/consultation/history/${sessionId}`);
  };

  return (
    <main className={styles.page}>
      <SessionList
        sessions={historySessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={handleSelectSession}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
      />
      <div className={styles.contentPane}>
        <MessageHistory
          sessionId={hasSelectedSession ? selectedSessionId : null}
          isSelectionPending={isSelectionPending}
          missingSessionId={missingSessionId}
        />
      </div>
    </main>
  );
}
