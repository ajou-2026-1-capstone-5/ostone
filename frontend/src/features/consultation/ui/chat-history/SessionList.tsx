import { EmptyState, ErrorState, Eyebrow, LoadingSpinner } from "@/shared/ui/ostone/atoms";
import { useChatSessions } from "../../api/chatHistoryApi";
import { SessionCard } from "./SessionCard";
import styles from "./SessionList.module.css";

interface SessionListProps {
  workspaceId: string;
  selectedSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "채팅 기록을 불러오지 못했습니다";
}

export function SessionList({ workspaceId, selectedSessionId, onSelectSession }: SessionListProps) {
  const { data: sessions = [], isLoading, isError, error, refetch } = useChatSessions({
    workspaceId,
    status: "completed",
  });
  const validSessions = sessions.filter(
    (session): session is typeof session & { id: number } => session.id != null,
  );

  if (isLoading) {
    return (
      <aside className={styles.wrapper} aria-label="채팅 기록 목록">
        <div className={styles.header}>
          <Eyebrow>Chat history</Eyebrow>
          <span className={styles.count}>불러오는 중</span>
        </div>
        <div className={styles.stateArea}>
          <LoadingSpinner />
        </div>
      </aside>
    );
  }

  if (isError) {
    return (
      <aside className={styles.wrapper} aria-label="채팅 기록 목록">
        <div className={styles.header}>
          <Eyebrow>Chat history</Eyebrow>
          <span className={styles.count}>오류</span>
        </div>
        <div className={styles.stateArea}>
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.wrapper} aria-label="채팅 기록 목록">
      <div className={styles.header}>
        <Eyebrow>Chat history</Eyebrow>
        <span className={styles.count}>{validSessions.length}개 세션</span>
      </div>

      {validSessions.length === 0 ? (
        <div className={styles.stateArea}>
          <EmptyState message="아직 채팅 기록이 없습니다" />
        </div>
      ) : (
        <div className={styles.list}>
          {validSessions.map((session) => {
            const sessionId = String(session.id);
            return (
              <SessionCard
                key={sessionId}
                session={session}
                isSelected={selectedSessionId === sessionId}
                onSelectSession={onSelectSession}
              />
            );
          })}
        </div>
      )}
    </aside>
  );
}
