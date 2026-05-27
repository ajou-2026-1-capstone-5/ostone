import { Avatar, Mono, Pill } from "@/shared/ui/ostone/atoms";
import type { ChatSession } from "../../api/consultationApi";
import styles from "./SessionCard.module.css";

type SessionMeta = {
  title?: string;
  messageCount?: number;
  lastMessagePreview?: string;
  lastMessage?: string;
  preview?: string;
};

interface SessionCardProps {
  session: ChatSession;
  isSelected: boolean;
  onSelectSession: (sessionId: string) => void;
}

function parseMeta(metaJson?: string): SessionMeta {
  if (!metaJson) return {};

  try {
    const meta = JSON.parse(metaJson) as SessionMeta;
    return meta && typeof meta === "object" ? meta : {};
  } catch {
    return {};
  }
}

function formatSessionDate(dateStr?: string): string {
  if (!dateStr) return "날짜 없음";
  return new Date(dateStr).toLocaleDateString("ko-KR");
}

function getPreview(meta: SessionMeta): string {
  return meta.lastMessagePreview ?? meta.lastMessage ?? meta.preview ?? "최근 메시지가 없습니다";
}

function getTitle(meta: SessionMeta, channel: string): string {
  return meta.title?.trim() || channel;
}

function getMessageCount(meta: SessionMeta): number {
  return meta.messageCount ?? 0;
}

export function SessionCard({ session, isSelected, onSelectSession }: SessionCardProps) {
  const sessionId = String(session.id ?? "");
  const channel = session.channel ?? "채널 없음";
  const meta = parseMeta(session.metaJson);
  const title = getTitle(meta, channel);
  const eyebrow = title === channel ? "채널" : channel;

  const handleSelect = () => {
    if (sessionId) onSelectSession(sessionId);
  };

  return (
    <button
      type="button"
      className={`${styles.card} ${isSelected ? styles.selected : ""}`}
      onClick={handleSelect}
      aria-pressed={isSelected}
    >
      <div className={styles.header}>
        <Avatar initial={channel.charAt(0)} tone={isSelected ? "signal" : "mute"} size={32} />
        <div className={styles.titleGroup}>
          <span className={styles.channelLabel}>{eyebrow}</span>
          <span className={styles.channel}>{title}</span>
          <Mono className={styles.date}>{formatSessionDate(session.startedAt)}</Mono>
        </div>
        <Pill tone={isSelected ? "signal" : "mute"}>메시지 {getMessageCount(meta)}개</Pill>
      </div>
      <p className={styles.preview}>{getPreview(meta)}</p>
    </button>
  );
}
