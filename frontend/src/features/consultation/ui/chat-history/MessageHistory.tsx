import { Dot, EmptyState, ErrorState, Eyebrow, Icon, LoadingSpinner, Mono, Pill } from "@/shared/ui/ostone/atoms";
import type { ChatMessage } from "../../api/consultationApi";
import { useChatMessages } from "../../api/chatHistoryApi";
import styles from "./MessageHistory.module.css";

interface MessageHistoryProps {
  sessionId?: string | null;
}

function formatTimestamp(dateStr?: string): string {
  if (!dateStr) return "시간 없음";
  return new Date(dateStr).toLocaleString("ko-KR");
}

function getRoleLabel(senderRole?: string): string {
  if (senderRole === "AGENT" || senderRole === "COUNSELOR") return "상담사";
  if (senderRole === "CUSTOMER") return "고객";
  return "시스템";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "메시지를 불러오지 못했습니다";
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const roleLabel = getRoleLabel(message.senderRole);
  const isCounselor = roleLabel === "상담사";
  const isSystem = roleLabel === "시스템";

  if (isSystem) {
    return (
      <div className={styles.systemRow}>
        <Dot tone="mute" />
        <Mono className={styles.systemText}>{message.content ?? "내용 없음"}</Mono>
      </div>
    );
  }

  return (
    <article className={`${styles.messageRow} ${isCounselor ? styles.counselorRow : styles.customerRow}`}>
      <div className={`${styles.bubble} ${isCounselor ? styles.counselorBubble : styles.customerBubble}`}>
        <div className={styles.metaLine}>
          <span className={styles.roleLabel}>{roleLabel}</span>
          <Pill tone={isCounselor ? "signal" : "mute"}>{message.messageType ?? "TEXT"}</Pill>
        </div>
        <p className={styles.content}>{message.content ?? "내용 없음"}</p>
        <Mono className={styles.timestamp}>{formatTimestamp(message.createdAt)}</Mono>
      </div>
    </article>
  );
}

export function MessageHistory({ sessionId }: MessageHistoryProps) {
  const activeSessionId = sessionId ?? "";
  const { data: messages = [], isLoading, isError, error, refetch } = useChatMessages(activeSessionId);

  if (!activeSessionId) {
    return (
      <section className={styles.wrapper} aria-label="채팅 메시지 내역">
        <div className={styles.placeholder}>
          <Icon name="msg" size={18} />
          <span>좌측 목록에서 세션을 선택해주세요</span>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className={styles.wrapper} aria-label="채팅 메시지 내역">
        <Header countText="불러오는 중" />
        <div className={styles.stateArea}>
          <LoadingSpinner />
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={styles.wrapper} aria-label="채팅 메시지 내역">
        <Header countText="오류" />
        <div className={styles.stateArea}>
          <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.wrapper} aria-label="채팅 메시지 내역">
      <Header countText={`${messages.length}개 메시지`} />
      {messages.length === 0 ? (
        <div className={styles.stateArea}>
          <EmptyState message="아직 메시지가 없습니다" />
        </div>
      ) : (
        <div className={styles.messageList}>
          {messages.map((message) => (
            <MessageBubble key={String(message.id ?? message.seqNo)} message={message} />
          ))}
        </div>
      )}
    </section>
  );
}

function Header({ countText }: { countText: string }) {
  return (
    <div className={styles.header}>
      <div className={styles.titleGroup}>
        <Eyebrow>Message history</Eyebrow>
        <span className={styles.title}>상담 메시지</span>
      </div>
      <Mono className={styles.count}>{countText}</Mono>
    </div>
  );
}
