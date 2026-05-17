import type { DemoChatMessage } from "../model/chatWorkflow.types";
import styles from "./chat-workflow-demo.module.css";

interface ChatTimelinePanelProps {
  messages: DemoChatMessage[];
  activeMessageId?: string | null;
  selectedMessageId?: string | null;
  onMessageSelect?: (messageId: string) => void;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toISOString().substring(11, 19);
}

function roleLabel(role: DemoChatMessage["role"]): string {
  return role === "user" ? "customer" : "agent";
}

export function ChatTimelinePanel({
  messages,
  activeMessageId,
  selectedMessageId,
  onMessageSelect,
}: ChatTimelinePanelProps) {
  return (
    <div className={styles.timeline}>
      <div className={styles.timelineHeader}>
        <div>
          <span className={styles.eyebrow}>Runtime Script</span>
          <h3 className={styles.sectionTitle}>Chat Timeline</h3>
        </div>
        <span className={styles.count}>{messages.length} turns</span>
      </div>
      <div
        data-scrollable
        className={styles.messageList}
      >
        {messages.length === 0 ? (
          <p className={styles.empty}>
            대화 내역이 없습니다.
          </p>
        ) : (
          messages.map((msg) => {
            const isSelected = msg.id === selectedMessageId;
            const isActive = msg.id === activeMessageId;
            const isAgent = msg.role === "assistant";
            return (
              <button
                type="button"
                key={msg.id}
                data-testid={`chat-message-${msg.id}`}
                onClick={() => onMessageSelect?.(msg.id)}
                className={`${styles.messageButton} ${
                  isAgent ? styles.messageAgent : styles.messageCustomer
                } ${
                  isActive ? styles.messageActive : ""
                } ${
                  isSelected ? styles.messageSelected : ""
                }`}
              >
                <div className={styles.messageMeta}>
                  <span
                    className={`${styles.role} ${
                      isAgent ? styles.roleAssistant : styles.roleCustomer
                    }`}
                  >
                    {roleLabel(msg.role)}
                  </span>
                  <span className={styles.messageMetaRight}>
                    {isActive && <span className={styles.activeBadge}>Processing</span>}
                    <span className={styles.time}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </span>
                </div>
                <p className={styles.messageContent}>{msg.content}</p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
