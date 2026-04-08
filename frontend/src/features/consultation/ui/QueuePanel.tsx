import React from 'react';
import { Inbox } from 'lucide-react';
import styles from './queue-panel.module.css';

export interface QueueCustomer {
  id: string;
  name: string;
  channel: string;
  handoffReason: string;
  waitMinutes: number;
  hasUnread: boolean;
}

interface QueuePanelProps {
  customers: QueueCustomer[];
  activeCustomerId: string | null;
  onSelectCustomer: (id: string) => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({
  customers,
  activeCustomerId,
  onSelectCustomer,
}) => {
  return (
    <aside className={styles.queueWrapper}>
      <div className={styles.queueHeader}>
        <h3 className={styles.queueTitle}>대기 고객</h3>
        <span className={styles.queueCount}>{customers.length}명 대기중</span>
      </div>

      <div className={styles.queueList}>
        {customers.length === 0 ? (
          <div className={styles.emptyQueue}>
            <InboxIcon size={40} className={styles.emptyIcon} />
            <p className={styles.emptyText}>대기중인 고객이 없습니다</p>
          </div>
        ) : (
          customers.map((c) => (
            <div
              key={c.id}
              className={`${styles.queueItem} ${activeCustomerId === c.id ? styles.queueItemActive : ''}`}
              onClick={() => onSelectCustomer(c.id)}
            >
              <div
                className={`${styles.customerAvatar} ${activeCustomerId === c.id ? styles.customerAvatarActive : ''}`}
              >
                {c.name.charAt(0)}
              </div>
              <div className={styles.queueItemInfo}>
                <div className={styles.customerName}>{c.name}</div>
                <div className={styles.handoffPreview}>{c.handoffReason}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className={styles.waitTime}>{c.waitMinutes}분 전</span>
                {c.hasUnread && <span className={styles.unreadDot}></span>}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
