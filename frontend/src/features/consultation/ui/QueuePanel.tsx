import React from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import styles from "./queue-panel.module.css";

export interface QueueCustomer {
  id: string;
  name?: string;
  title?: string;
  channel: string;
  handoffReason: string;
  waitMinutes: number;
  hasUnread: boolean;
  status?: string | null;
  statusLabel?: string;
  assignedCounselorId?: number | null;
  startedAt?: string | null;
}

interface QueuePanelProps {
  customers: QueueCustomer[];
  activeCustomerId: string | null;
  onSelectCustomer: (id: string) => void;
  isLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  customers,
  activeCustomerId,
  onSelectCustomer,
  isLoading = false,
  loadError = null,
  onRetry,
}) => {
  const renderQueueState = () => {
    if (isLoading) {
      return (
        <div className={styles.emptyQueue} aria-live="polite">
          <LoaderCircle size={36} className={styles.loadingIcon} />
          <p className={styles.emptyText}>대기열을 불러오는 중입니다</p>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className={styles.emptyQueue} role="alert">
          <AlertCircle size={36} className={styles.emptyIcon} />
          <p className={styles.emptyText}>{loadError}</p>
          {onRetry && (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              다시 시도
            </button>
          )}
        </div>
      );
    }

    if (customers.length === 0) {
      return (
        <div className={styles.emptyQueue}>
          <Inbox size={40} className={styles.emptyIcon} />
          <p className={styles.emptyText}>대기중인 고객이 없습니다</p>
        </div>
      );
    }

    return customers.map((c) => {
      const displayName = c.name?.trim() || "Unknown";
      const subject = c.title?.trim() || c.handoffReason;
      return (
        <div
          key={c.id}
          role="button"
          tabIndex={0}
          className={`${styles.queueItem} ${activeCustomerId === c.id ? styles.queueItemActive : ""}`}
          onClick={() => onSelectCustomer(c.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelectCustomer(c.id);
            }
          }}
        >
          <div
            className={`${styles.customerAvatar} ${activeCustomerId === c.id ? styles.customerAvatarActive : ""}`}
          >
            {displayName.charAt(0)}
          </div>
          <div className={styles.queueItemInfo}>
            <div className={styles.customerName}>{displayName}</div>
            <div className={styles.handoffPreview}>{subject}</div>
            {c.statusLabel && <div className={styles.sessionStatus}>{c.statusLabel}</div>}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
            }}
          >
            <span className={styles.waitTime}>{c.waitMinutes}분 전</span>
            {c.hasUnread && <span className={styles.unreadDot}></span>}
          </div>
        </div>
      );
    });
  };

  return (
    <aside className={styles.queueWrapper}>
      <div className={styles.queueHeader}>
        <h3 className={styles.queueTitle}>대기 고객</h3>
        <span className={styles.queueCount}>{customers.length}명 대기중</span>
      </div>

      <div className={styles.queueList}>{renderQueueState()}</div>
    </aside>
  );
};
