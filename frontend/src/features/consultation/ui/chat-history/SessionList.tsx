import { EmptyState, ErrorState, Eyebrow, LoadingSpinner } from "@/shared/ui/ostone/atoms";
import type { ChatSession } from "../../api/consultationApi";
import { SessionCard } from "./SessionCard";
import styles from "./SessionList.module.css";

interface SessionListProps {
  sessions: ChatSession[];
  selectedSessionId?: string | null;
  onSelectSession: (sessionId: string) => void;
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry: () => void;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "채팅 기록을 불러오지 못했습니다";
}

export function SessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
  isLoading = false,
  isError = false,
  error,
  onRetry,
}: SessionListProps) {
  const validSessions = sessions.filter(
    (session): session is typeof session & { id: number } =>
      session.id != null && (session.status === "COMPLETED" || session.status === "RESOLVED"),
  );

  if (isLoading) {
    return (
      <aside className={styles.wrapper} aria-label="채팅 기록 목록">
        <div className={styles.header}>
          <Eyebrow>상담 이력</Eyebrow>
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
          <Eyebrow>상담 이력</Eyebrow>
          <span className={styles.count}>오류</span>
        </div>
        <div className={styles.stateArea}>
          <ErrorState message={getErrorMessage(error)} onRetry={onRetry} />
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.wrapper} aria-label="채팅 기록 목록">
      <div className={styles.header}>
        <Eyebrow>상담 이력</Eyebrow>
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
